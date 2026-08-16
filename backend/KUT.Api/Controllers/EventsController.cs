using KUT.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KUT.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventsController : ControllerBase
{
    private readonly KutDbContext _db;

    public EventsController(KutDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetEvents([FromQuery] int limit = 100)
    {
        limit = Math.Clamp(limit, 1, 500);

        var events = await _db.Events
            .OrderByDescending(e => e.Timestamp)
            .Take(limit)
            .ToListAsync();

        return Ok(events);
    }
}
