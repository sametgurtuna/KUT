using KUT.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KUT.Api.Controllers;

public class GraphNode
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}

public class GraphEdge
{
    public string From { get; set; } = string.Empty;
    public string To { get; set; } = string.Empty;
    public string Relation { get; set; } = string.Empty;
}

public class GraphResponse
{
    public List<GraphNode> Nodes { get; set; } = new();
    public List<GraphEdge> Edges { get; set; } = new();
}

[ApiController]
[Route("api/[controller]")]
public class GraphController : ControllerBase
{
    private readonly KutDbContext _db;

    public GraphController(KutDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetGraph()
    {
        var response = new GraphResponse();

        var organizations = await _db.Organizations.ToListAsync();
        var teams = await _db.Teams.ToListAsync();
        var vehicles = await _db.Vehicles.ToListAsync();
        var incidents = await _db.Incidents.ToListAsync();

        foreach (var org in organizations)
        {
            response.Nodes.Add(new GraphNode
            {
                Id = $"org-{org.Id}",
                Type = "Organization",
                Label = org.Name
            });
        }

        foreach (var team in teams)
        {
            response.Nodes.Add(new GraphNode
            {
                Id = $"team-{team.Id}",
                Type = "Team",
                Label = team.Name
            });

            response.Edges.Add(new GraphEdge
            {
                From = $"org-{team.OrganizationId}",
                To = $"team-{team.Id}",
                Relation = "owns"
            });
        }

        foreach (var vehicle in vehicles)
        {
            response.Nodes.Add(new GraphNode
            {
                Id = $"vehicle-{vehicle.Id}",
                Type = "Vehicle",
                Label = vehicle.Name
            });

            response.Edges.Add(new GraphEdge
            {
                From = $"team-{vehicle.TeamId}",
                To = $"vehicle-{vehicle.Id}",
                Relation = "operates"
            });
        }

        foreach (var incident in incidents)
        {
            response.Nodes.Add(new GraphNode
            {
                Id = $"incident-{incident.Id}",
                Type = "Incident",
                Label = $"{incident.Type} (Severity {incident.Severity})"
            });
        }

        return Ok(response);
    }
}