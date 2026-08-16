namespace KUT.Api.Models;

public class Incident
{
    public int Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public int Severity { get; set; }
    public string Status { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTime CreatedAt { get; set; }
}