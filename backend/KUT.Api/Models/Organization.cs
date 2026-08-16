namespace KUT.Api.Models;

public class Organization
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;

    public ICollection<Team> Teams { get; set; } = new List<Team>();
}