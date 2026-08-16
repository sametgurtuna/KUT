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
    // Number of OSRM coord points to advance per tick; higher = faster vehicle.
    private const int StepPerTick = 3;

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

            var nextIdx = Math.Min(assignment.RouteIndex + StepPerTick, path.Count - 1);

            // Compute heading from previous point for a nice marker rotation.
            var prev = path[Math.Max(0, nextIdx - 1)];
            var cur = path[nextIdx];
            var heading = Bearing(prev[1], prev[0], cur[1], cur[0]);

            vehicle.Longitude = cur[0];
            vehicle.Latitude = cur[1];
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
