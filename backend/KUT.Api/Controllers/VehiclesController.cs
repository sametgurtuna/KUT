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
public class VehiclesController : ControllerBase
{
    private readonly KutDbContext _db;
    private readonly IHubContext<KutHub> _hub;
    private readonly OsrmClient _osrm;

    public VehiclesController(KutDbContext db, IHubContext<KutHub> hub, OsrmClient osrm)
    {
        _db = db;
        _hub = hub;
        _osrm = osrm;
    }

    [HttpGet]
    public async Task<IActionResult> GetVehicles()
    {
        var vehicles = await _db.Vehicles
            .Include(v => v.Team)
            .ToListAsync();

        return Ok(vehicles);
    }

    public class CreateVehicleRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Capabilities { get; set; } = string.Empty;
        public int TeamId { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateVehicleRequest request)
    {
        if (!await _db.Teams.AnyAsync(t => t.Id == request.TeamId))
        {
            return BadRequest(new { error = "Team not found." });
        }

        var vehicle = new Vehicle
        {
            Name = string.IsNullOrWhiteSpace(request.Name) ? $"Araç-{DateTime.UtcNow.Ticks % 10000}" : request.Name,
            Type = request.Type,
            Capabilities = request.Capabilities ?? string.Empty,
            Status = "Available",
            TeamId = request.TeamId,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
        };
        _db.Vehicles.Add(vehicle);

        var evt = new Event
        {
            EventType = "VEHICLE_CREATED",
            EntityType = "Vehicle",
            EntityId = 0,
            Timestamp = DateTime.UtcNow,
            Payload = JsonSerializer.Serialize(new
            {
                name = vehicle.Name,
                type = vehicle.Type,
                teamId = vehicle.TeamId,
            }),
        };
        _db.Events.Add(evt);
        await _db.SaveChangesAsync();

        evt.EntityId = vehicle.Id;
        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("VehicleCreated", vehicle);
        await _hub.Clients.All.SendAsync("EventLogged", evt);
        return Ok(vehicle);
    }

    public class UpdateLocationRequest
    {
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }

    [HttpPatch("{id}/location")]
    public async Task<IActionResult> UpdateLocation(int id, UpdateLocationRequest request)
    {
        var vehicle = await _db.Vehicles.FindAsync(id);

        if (vehicle == null)
        {
            return NotFound();
        }

        vehicle.Latitude = request.Latitude;
        vehicle.Longitude = request.Longitude;

        var vehicleEvent = new Event
        {
            EventType = "VEHICLE_MOVED",
            EntityType = "Vehicle",
            EntityId = vehicle.Id,
            Timestamp = DateTime.UtcNow,
            Payload = JsonSerializer.Serialize(new
            {
                latitude = request.Latitude,
                longitude = request.Longitude,
            }),
        };

        _db.Events.Add(vehicleEvent);

        // A dragged vehicle invalidates any route it was driving: recompute from
        // the new position so the simulator and the map both follow real roads.
        var activeAssignments = await _db.Assignments
            .Where(a => a.VehicleId == vehicle.Id && a.Status == "Active")
            .ToListAsync();

        foreach (var assignment in activeAssignments)
        {
            var incident = await _db.Incidents.FindAsync(assignment.IncidentId);
            if (incident == null) continue;

            var geom = await _osrm.RouteAsync(
                (vehicle.Longitude, vehicle.Latitude),
                (incident.Longitude, incident.Latitude));

            assignment.RoutePath = geom != null ? JsonSerializer.Serialize(geom.Coordinates) : null;
            assignment.RouteIndex = 0;
            assignment.RouteVersion++;
            assignment.EtaSeconds = geom != null ? (int)Math.Round(geom.DurationMin * 60) : null;
            assignment.LastAdvancedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        await _hub.Clients.All.SendAsync("VehicleUpdated", vehicle);
        await _hub.Clients.All.SendAsync("EventLogged", vehicleEvent);
        foreach (var assignment in activeAssignments)
        {
            await _hub.Clients.All.SendAsync("AssignmentUpdated", assignment);
        }

        return Ok(vehicle);
    }
}