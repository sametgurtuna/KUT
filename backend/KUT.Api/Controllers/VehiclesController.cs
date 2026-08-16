using KUT.Api.Data;
using KUT.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KUT.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VehiclesController : ControllerBase
{
    private readonly KutDbContext _db;

    public VehiclesController(KutDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetVehicles()
    {
        var vehicles = await _db.Vehicles
            .Include(v => v.Team)
            .ToListAsync();

        return Ok(vehicles);
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
            Payload = $"{{\"latitude\":{request.Latitude},\"longitude\":{request.Longitude}}}"
        };

        _db.Events.Add(vehicleEvent);

        await _db.SaveChangesAsync();

        return Ok(vehicle);
    }
}