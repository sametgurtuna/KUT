namespace KUT.Api.Models;

public class Team
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;

    public int OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
}