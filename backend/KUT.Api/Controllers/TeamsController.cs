using KUT.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KUT.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TeamsController : ControllerBase
{
    private readonly KutDbContext _db;

    public TeamsController(KutDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetTeams()
    {
        var teams = await _db.Teams
            .Include(t => t.Vehicles)
            .ToListAsync();

        return Ok(teams);
    }
}