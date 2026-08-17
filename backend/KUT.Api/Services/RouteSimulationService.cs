using System.Text.Json;
using KUT.Api.Data;
using KUT.Api.Hubs;
using KUT.Api.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace KUT.Api.Services;

/// <summary>
/// Walks Dispatched vehicles along their assignment's OSRM route once per tick.
/// Every advance emits a VEHICLE_MOVED event and broadcasts VehicleUpdated so
/// the frontend sees continuous motion; hitting the last coord auto-resolves
/// the assignment and the incident.
/// </summary>
public class RouteSimulationService : BackgroundService
{
    private static readonly TimeSpan TickInterval = TimeSpan.FromMilliseconds(1200);
    // Wall-clock seconds compressed into one simulated second. The vehicle still
    // drives at the route's real average speed — this only fast-forwards it so a
    // 40-minute dispatch is watchable.
    private const double TimeCompression = 12.0;
    // Used when an assignment has no ETA to derive a speed from (~50 km/h).
    private const double FallbackSpeedMps = 13.9;
    // A tick that arrives late (paused debugger, slow DB) must not teleport the
    // vehicle across town.
    private const double MaxTickSeconds = 5.0;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RouteSimulationService> _logger;

    public RouteSimulationService(IServiceScopeFactory scopeFactory, ILogger<RouteSimulationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RouteSimulationService tick failed");
            }
            await Task.Delay(TickInterval, stoppingToken);
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KutDbContext>();
        var hub = scope.ServiceProvider.GetRequiredService<IHubContext<KutHub>>();
        var osrm = scope.ServiceProvider.GetRequiredService<OsrmClient>();

        // Self-heal: a dispatch created while OSRM was rate-limited has no
        // geometry, so the map falls back to a straight line forever. Retry the
        // routing here until it sticks.
        await RepairMissingRoutesAsync(db, hub, osrm, ct);

        var active = await db.Assignments
            .Where(a => a.Status == "Active" && a.RoutePath != null)
            .ToListAsync(ct);

        foreach (var assignment in active)
        {
            List<double[]>? path;
            try
            {
                path = JsonSerializer.Deserialize<List<double[]>>(assignment.RoutePath!);
            }
            catch
            {
                continue;
            }
            if (path == null || path.Count < 2) continue;

            var vehicle = await db.Vehicles.FindAsync(new object[] { assignment.VehicleId }, ct);
            if (vehicle == null) continue;

            // Drive a real distance this tick — road speed × elapsed time —
            // rather than a fixed number of vertices, so the vehicle keeps a
            // steady pace through dense junction geometry and open motorway alike.
            var since = assignment.LastAdvancedAt is { } last
                ? (DateTime.UtcNow - last).TotalSeconds
                : TickInterval.TotalSeconds;
            var elapsed = Math.Clamp(since, 0, MaxTickSeconds);
            if (elapsed <= 0) elapsed = TickInterval.TotalSeconds;

            var budget = SpeedMps(assignment, path) * TimeCompression * elapsed;
            var (nextIdx, lon, lat) = Advance(
                path, assignment.RouteIndex, vehicle.Longitude, vehicle.Latitude, budget);

            // Heading from the point just behind us, for marker rotation.
            var prev = path[Math.Max(0, Math.Min(nextIdx, path.Count - 1))];
            var heading = Bearing(prev[1], prev[0], lat, lon);
            if (Math.Abs(prev[0] - lon) < 1e-9 && Math.Abs(prev[1] - lat) < 1e-9)
            {
                heading = vehicle.Heading ?? heading;
            }

            vehicle.Longitude = lon;
            vehicle.Latitude = lat;
            vehicle.Heading = heading;

            var evt = new Event
            {
                EventType = "VEHICLE_MOVED",
                EntityType = "Vehicle",
                EntityId = vehicle.Id,
                Timestamp = DateTime.UtcNow,
                Payload = JsonSerializer.Serialize(new
                {
                    latitude = vehicle.Latitude,
                    longitude = vehicle.Longitude,
                    source = "sim",
                }),
            };
            db.Events.Add(evt);

            assignment.RouteIndex = nextIdx;
            assignment.LastAdvancedAt = DateTime.UtcNow;

            var arrived = nextIdx >= path.Count - 1;
            Event? resolveEvt = null;
            Incident? incident = null;
            if (arrived)
            {
                incident = await db.Incidents.FindAsync(new object[] { assignment.IncidentId }, ct);
                assignment.Status = "Resolved";
                vehicle.Status = "Available";
                if (incident != null) incident.Status = "Resolved";
                resolveEvt = new Event
                {
                    EventType = "INCIDENT_RESOLVED",
                    EntityType = "Assignment",
                    EntityId = assignment.Id,
                    Timestamp = DateTime.UtcNow,
                    Payload = JsonSerializer.Serialize(new
                    {
                        incidentId = assignment.IncidentId,
                        vehicleId = vehicle.Id,
                        source = "sim",
                    }),
                };
                db.Events.Add(resolveEvt);
            }

            await db.SaveChangesAsync(ct);

            await hub.Clients.All.SendAsync("VehicleUpdated", vehicle, ct);
            await hub.Clients.All.SendAsync("EventLogged", evt, ct);
            // Progress-only payload: the client already has the full geometry
            // and just needs to know how far along the vehicle is.
            await hub.Clients.All.SendAsync("AssignmentProgress", new
            {
                id = assignment.Id,
                routeIndex = assignment.RouteIndex,
                routeVersion = assignment.RouteVersion,
            }, ct);

            if (arrived)
            {
                await hub.Clients.All.SendAsync("AssignmentResolved", assignment, ct);
                if (incident != null)
                {
                    await hub.Clients.All.SendAsync("IncidentUpdated", incident, ct);
                }
                if (resolveEvt != null)
                {
                    await hub.Clients.All.SendAsync("EventLogged", resolveEvt, ct);
                }
            }
        }
    }

    /// <summary>
    /// The route's own average speed (total road distance ÷ OSRM's ETA), so a
    /// motorway run moves faster than a city crawl instead of every vehicle
    /// sharing one made-up speed.
    /// </summary>
    private static double SpeedMps(Assignment assignment, List<double[]> path)
    {
        if (assignment.EtaSeconds is not > 0) return FallbackSpeedMps;
        var meters = PathLengthMeters(path);
        if (meters <= 0) return FallbackSpeedMps;
        return Math.Clamp(meters / assignment.EtaSeconds.Value, 3.0, 45.0);
    }

    private static double PathLengthMeters(List<double[]> path)
    {
        double total = 0;
        for (int i = 1; i < path.Count; i++)
        {
            total += OsrmClient.HaversineMeters(path[i - 1][1], path[i - 1][0], path[i][1], path[i][0]);
        }
        return total;
    }

    /// <summary>
    /// Walks <paramref name="meters"/> along the polyline, starting from the
    /// vehicle's current position inside segment <paramref name="fromIndex"/> →
    /// <paramref name="fromIndex"/>+1 (not from the vertex itself, so the
    /// part-segment already covered is never re-driven). Returns the last vertex
    /// passed plus the exact interpolated position after it — the vehicle lands
    /// where it would really be, not on the nearest vertex.
    /// </summary>
    private static (int Index, double Lon, double Lat) Advance(
        List<double[]> path, int fromIndex, double curLon, double curLat, double meters)
    {
        var i = Math.Clamp(fromIndex, 0, path.Count - 1);
        if (i >= path.Count - 1)
        {
            return (path.Count - 1, path[^1][0], path[^1][1]);
        }

        var remaining = Math.Max(0, meters);
        // First segment starts at the live position rather than path[i].
        double[] a = { curLon, curLat };
        while (i < path.Count - 1)
        {
            var b = path[i + 1];
            var seg = OsrmClient.HaversineMeters(a[1], a[0], b[1], b[0]);
            if (seg > 0 && remaining < seg)
            {
                var t = remaining / seg;
                return (i, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
            }
            remaining -= Math.Max(0, seg);
            i++;
            a = b;
        }
        return (path.Count - 1, path[^1][0], path[^1][1]);
    }

    private async Task RepairMissingRoutesAsync(
        KutDbContext db, IHubContext<KutHub> hub, OsrmClient osrm, CancellationToken ct)
    {
        var broken = await db.Assignments
            .Where(a => a.Status == "Active" && a.RoutePath == null)
            .ToListAsync(ct);
        if (broken.Count == 0) return;

        foreach (var assignment in broken)
        {
            var vehicle = await db.Vehicles.FindAsync(new object[] { assignment.VehicleId }, ct);
            var incident = await db.Incidents.FindAsync(new object[] { assignment.IncidentId }, ct);
            if (vehicle == null || incident == null) continue;

            var geom = await osrm.RouteAsync(
                (vehicle.Longitude, vehicle.Latitude),
                (incident.Longitude, incident.Latitude),
                ct);
            if (geom == null)
            {
                _logger.LogWarning(
                    "Assignment {Id} still has no road geometry; retrying next tick", assignment.Id);
                continue;
            }

            assignment.RoutePath = JsonSerializer.Serialize(geom.Coordinates);
            assignment.RouteIndex = 0;
            assignment.RouteVersion++;
            assignment.EtaSeconds = (int)Math.Round(geom.DurationMin * 60);
            assignment.LastAdvancedAt = DateTime.UtcNow;

            await db.SaveChangesAsync(ct);
            await hub.Clients.All.SendAsync("AssignmentUpdated", assignment, ct);
        }
    }

    private static double Bearing(double lat1, double lon1, double lat2, double lon2)
    {
        var phi1 = lat1 * Math.PI / 180;
        var phi2 = lat2 * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var y = Math.Sin(dLon) * Math.Cos(phi2);
        var x = Math.Cos(phi1) * Math.Sin(phi2) - Math.Sin(phi1) * Math.Cos(phi2) * Math.Cos(dLon);
        var brng = Math.Atan2(y, x) * 180 / Math.PI;
        return (brng + 360) % 360;
    }
}
