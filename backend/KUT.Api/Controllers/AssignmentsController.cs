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
public class AssignmentsController : ControllerBase
{
    private readonly KutDbContext _db;
    private readonly IHubContext<KutHub> _hub;
    private readonly OsrmClient _osrm;

    public AssignmentsController(KutDbContext db, IHubContext<KutHub> hub, OsrmClient osrm)
    {
        _db = db;
        _hub = hub;
        _osrm = osrm;
    }

    [HttpGet]
    public async Task<IActionResult> GetActive()
    {
        var assignments = await _db.Assignments
            .Where(a => a.Status == "Active")
            .Include(a => a.Vehicle)
            .Include(a => a.Incident)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        return Ok(assignments);
    }

    public class CreateAssignmentRequest
    {
        public int IncidentId { get; set; }
        public int VehicleId { get; set; }
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateAssignmentRequest request)
    {
        var incident = await _db.Incidents.FindAsync(request.IncidentId);
        var vehicle = await _db.Vehicles.FindAsync(request.VehicleId);

        if (incident == null || vehicle == null)
        {
            return NotFound();
        }

        // Fetch driving geometry so the RouteSimulationService can walk the
        // vehicle along real roads. Missing path is fine — simulator skips it
        // and the frontend still draws a straight line.
        var geom = await _osrm.RouteAsync(
            (vehicle.Longitude, vehicle.Latitude),
            (incident.Longitude, incident.Latitude));

        var assignment = new Assignment
        {
            IncidentId = incident.Id,
            VehicleId = vehicle.Id,
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            RoutePath = geom != null ? JsonSerializer.Serialize(geom.Coordinates) : null,
            RouteIndex = 0,
            LastAdvancedAt = DateTime.UtcNow,
            EtaSeconds = geom != null ? (int)Math.Round(geom.DurationMin * 60) : null,
        };
        _db.Assignments.Add(assignment);

        vehicle.Status = "Dispatched";

        _db.Events.Add(new Event
        {
            EventType = "VEHICLE_ASSIGNED",
            EntityType = "Assignment",
            EntityId = 0, // set after save
            Timestamp = DateTime.UtcNow,
            Payload = JsonSerializer.Serialize(new
            {
                incidentId = incident.Id,
                vehicleId = vehicle.Id,
            }),
        });

        await _db.SaveChangesAsync();

        // Fix EntityId now that assignment has its Id.
        var latestEvent = await _db.Events
            .Where(e => e.EventType == "VEHICLE_ASSIGNED" && e.EntityId == 0)
            .OrderByDescending(e => e.Id)
            .FirstAsync();
        latestEvent.EntityId = assignment.Id;
        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("AssignmentCreated", assignment);
        await _hub.Clients.All.SendAsync("VehicleUpdated", vehicle);
        await _hub.Clients.All.SendAsync("EventLogged", latestEvent);

        return Ok(assignment);
    }

    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancel(int id)
    {
        var assignment = await _db.Assignments.FindAsync(id);
        if (assignment == null || assignment.Status != "Active")
        {
            return NotFound();
        }

        var vehicle = await _db.Vehicles.FindAsync(assignment.VehicleId);
        if (vehicle == null)
        {
            return NotFound();
        }

        assignment.Status = "Cancelled";
        vehicle.Status = "Available";

        var releaseEvent = new Event
        {
            EventType = "VEHICLE_RELEASED",
            EntityType = "Assignment",
            EntityId = assignment.Id,
            Timestamp = DateTime.UtcNow,
            Payload = JsonSerializer.Serialize(new
            {
                incidentId = assignment.IncidentId,
                vehicleId = vehicle.Id,
            }),
        };
        _db.Events.Add(releaseEvent);

        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("AssignmentCancelled", assignment);
        await _hub.Clients.All.SendAsync("VehicleUpdated", vehicle);
        await _hub.Clients.All.SendAsync("EventLogged", releaseEvent);

        return Ok(assignment);
    }

    [HttpPost("{id}/resolve")]
    public async Task<IActionResult> Resolve(int id)
    {
        var assignment = await _db.Assignments.FindAsync(id);
        if (assignment == null || assignment.Status != "Active") return NotFound();

        var vehicle = await _db.Vehicles.FindAsync(assignment.VehicleId);
        var incident = await _db.Incidents.FindAsync(assignment.IncidentId);
        if (vehicle == null || incident == null) return NotFound();

        assignment.Status = "Resolved";
        vehicle.Status = "Available";
        incident.Status = "Resolved";

        var evt = new Event
        {
            EventType = "INCIDENT_RESOLVED",
            EntityType = "Assignment",
            EntityId = assignment.Id,
            Timestamp = DateTime.UtcNow,
            Payload = JsonSerializer.Serialize(new
            {
                incidentId = incident.Id,
                vehicleId = vehicle.Id,
            }),
        };
        _db.Events.Add(evt);
        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("AssignmentResolved", assignment);
        await _hub.Clients.All.SendAsync("VehicleUpdated", vehicle);
        await _hub.Clients.All.SendAsync("IncidentUpdated", incident);
        await _hub.Clients.All.SendAsync("EventLogged", evt);

        return Ok(assignment);
    }
}
