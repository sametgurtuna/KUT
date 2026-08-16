using KUT.Api.Data;
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
}