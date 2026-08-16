namespace KUT.Api.Models;

public class Event
{
    public int Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public int EntityId { get; set; }
    public DateTime Timestamp { get; set; }
    public string Payload { get; set; } = string.Empty;
}