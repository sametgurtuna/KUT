namespace KUT.Api.Models;

public class Vehicle
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    // Bearing in degrees (0 = north). Updated whenever location changes.
    public double? Heading { get; set; }
    // Comma-separated capability tags (e.g. "yangin,merdivenli"). Kept as a
    // simple string to avoid a join table for this early stage.
    public string Capabilities { get; set; } = string.Empty;

    public int TeamId { get; set; }
    public Team? Team { get; set; }
}