using System.Text.Json;
using KUT.Api.Data;
using KUT.Api.Hubs;
using KUT.Api.Models;
using KUT.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace KUT.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IncidentsController : ControllerBase
{
    private readonly KutDbContext _db;
    private readonly IHubContext<KutHub> _hub;
    private readonly OsrmClient _osrm;

    public IncidentsController(KutDbContext db, IHubContext<KutHub> hub, OsrmClient osrm)
    {
        _db = db;
        _hub = hub;
        _osrm = osrm;
    }

    [HttpGet]
    public async Task<IActionResult> GetIncidents()
    {
        var incidents = await _db.Incidents
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();

        return Ok(incidents);
    }

    public class CreateIncidentRequest
    {
        public string Type { get; set; } = string.Empty;
        public int Severity { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateIncidentRequest request)
    {
        var incident = new Incident
        {
            Type = request.Type,
            Severity = request.Severity,
            Status = "Open",
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Incidents.Add(incident);

        _db.Events.Add(new Event
        {
            EventType = "INCIDENT_CREATED",
            EntityType = "Incident",
            EntityId = 0,
            Timestamp = DateTime.UtcNow,
            Payload = JsonSerializer.Serialize(new
            {
                type = incident.Type,
                severity = incident.Severity,
                latitude = incident.Latitude,
                longitude = incident.Longitude,
            }),
        });

        await _db.SaveChangesAsync();

        var latestEvent = await _db.Events
            .Where(e => e.EventType == "INCIDENT_CREATED" && e.EntityId == 0)
            .OrderByDescending(e => e.Id)
            .FirstAsync();
        latestEvent.EntityId = incident.Id;
        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("IncidentCreated", incident);
        await _hub.Clients.All.SendAsync("EventLogged", latestEvent);

        return Ok(incident);
    }

    public class UpdateStatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }

    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, UpdateStatusRequest request)
    {
        var incident = await _db.Incidents.FindAsync(id);
        if (incident == null) return NotFound();

        var allowed = new[] { "Open", "InProgress", "Resolved" };
        if (!allowed.Contains(request.Status))
        {
            return BadRequest(new { error = "Status must be Open, InProgress, or Resolved." });
        }

        incident.Status = request.Status;

        var evt = new Event
        {
            EventType = "INCIDENT_STATUS_CHANGED",
            EntityType = "Incident",
            EntityId = incident.Id,
            Timestamp = DateTime.UtcNow,
            Payload = JsonSerializer.Serialize(new { status = incident.Status }),
        };
        _db.Events.Add(evt);
        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("IncidentUpdated", incident);
        await _hub.Clients.All.SendAsync("EventLogged", evt);
        return Ok(incident);
    }

    [HttpGet("{id}/recommendations")]
    public async Task<IActionResult> GetRecommendations(int id)
    {
        var incident = await _db.Incidents.FindAsync(id);

        if (incident == null)
        {
            return NotFound();
        }

        var availableVehicles = await _db.Vehicles
            .Where(v => v.Status == "Available")
            .Include(v => v.Team)
            .ToListAsync();

        // Try OSRM for actual driving distance/duration; fall back to Haversine
        // per row if OSRM is unreachable or returns null for a source.
        var sources = availableVehicles
            .Select(v => (v.Longitude, v.Latitude))
            .ToList();
        var metrics = await _osrm.TableToDestinationAsync(
            sources, (incident.Longitude, incident.Latitude));

        var recommendations = availableVehicles
            .Select((v, idx) =>
            {
                var m = metrics?[idx];
                double distanceKm;
                double? durationMin = null;
                string source;
                if (m != null)
                {
                    distanceKm = m.DistanceKm;
                    durationMin = m.DurationMin;
                    source = "osrm";
                }
                else
                {
                    distanceKm = Math.Round(
                        DistanceCalculator.CalculateDistanceKm(
                            incident.Latitude, incident.Longitude,
                            v.Latitude, v.Longitude
                        ), 2);
                    source = "haversine";
                }
                return new
                {
                    VehicleId = v.Id,
                    VehicleName = v.Name,
                    VehicleType = v.Type,
                    TeamName = v.Team != null ? v.Team.Name : null,
                    DistanceKm = distanceKm,
                    DurationMin = durationMin,
                    DistanceSource = source,
                    CompatibilityScore = CompatibilityMatrix.Score(incident.Type, v.Capabilities),
                };
            })
            // Match first (higher score wins), distance breaks the tie.
            .OrderByDescending(r => r.CompatibilityScore)
            .ThenBy(r => r.DistanceKm)
            .ToList();

        return Ok(recommendations);
    }
}
