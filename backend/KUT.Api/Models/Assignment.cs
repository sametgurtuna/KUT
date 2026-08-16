namespace KUT.Api.Models;

public class Assignment
{
    public int Id { get; set; }
    public int IncidentId { get; set; }
    public Incident? Incident { get; set; }

    public int VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }

    public string Status { get; set; } = "Active"; // Active | Resolved | Cancelled
    public DateTime CreatedAt { get; set; }

    // OSRM driving geometry as JSON [[lng,lat], …] captured when the assignment
    // is created. The RouteSimulationService walks the vehicle along it.
    public string? RoutePath { get; set; }
    public int RouteIndex { get; set; }
    // Bumped whenever the route is recomputed (e.g. the vehicle was dragged to
    // a new position). The UI re-plays its draw animation on version change.
    public int RouteVersion { get; set; }
    public DateTime? LastAdvancedAt { get; set; }
    // OSRM estimated arrival seconds, captured at create time. UI uses it for
    // a countdown; the simulator advances RouteIndex regardless.
    public int? EtaSeconds { get; set; }
}
