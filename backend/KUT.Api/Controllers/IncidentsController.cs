using KUT.Api.Data;
using KUT.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KUT.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IncidentsController : ControllerBase
{
    private readonly KutDbContext _db;

    public IncidentsController(KutDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetIncidents()
    {
        var incidents = await _db.Incidents
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();

        return Ok(incidents);
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

        var recommendations = availableVehicles
            .Select(v => new
            {
                VehicleId = v.Id,
                VehicleName = v.Name,
                VehicleType = v.Type,
                TeamName = v.Team != null ? v.Team.Name : null,
                DistanceKm = Math.Round(
                    DistanceCalculator.CalculateDistanceKm(
                        incident.Latitude, incident.Longitude,
                        v.Latitude, v.Longitude
                    ), 2)
            })
            .OrderBy(r => r.DistanceKm)
            .ToList();

        return Ok(recommendations);
    }
}