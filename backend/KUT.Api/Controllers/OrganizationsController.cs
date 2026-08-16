using KUT.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KUT.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrganizationsController : ControllerBase
{
    private readonly KutDbContext _db;

    public OrganizationsController(KutDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetOrganizations()
    {
        var organizations = await _db.Organizations
            .Include(o => o.Teams)
            .ToListAsync();

        return Ok(organizations);
    }
}