using System.Globalization;
using System.Text.Json;

namespace KUT.Api.Services;

/// <summary>
/// Thin wrapper around the OSRM public routing service. Uses the /table endpoint
/// to compute driving distance/duration from many sources to a single destination
/// in one call — much cheaper than N /route calls. Callers should always fall
/// back to Haversine when Result is null (public OSRM has rate limits and may be
/// slow or down).
/// </summary>
public class OsrmClient
{
    private readonly HttpClient _http;
    // Public demo endpoint. Swap for a self-hosted OSRM in production.
    private const string BaseUrl = "https://router.project-osrm.org";

    public OsrmClient(HttpClient http)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(5);
    }

    public record RouteMetric(double DistanceKm, double DurationMin);
    public record RouteGeometry(List<double[]> Coordinates, double DistanceKm, double DurationMin);

    /// <summary>
    /// Full driving route with geometry from one point to another. Null on failure.
    /// Coordinates are [lng, lat] pairs.
    /// </summary>
    public async Task<RouteGeometry?> RouteAsync(
        (double Lng, double Lat) from,
        (double Lng, double Lat) to,
        CancellationToken ct = default)
    {
        var inv = CultureInfo.InvariantCulture;
        var url = $"{BaseUrl}/route/v1/driving/"
                  + $"{from.Lng.ToString(inv)},{from.Lat.ToString(inv)};"
                  + $"{to.Lng.ToString(inv)},{to.Lat.ToString(inv)}"
                  + "?geometries=geojson&overview=full";
        try
        {
            using var response = await _http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode) return null;
            var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

            var route = doc.RootElement.GetProperty("routes")[0];
            var geom = route.GetProperty("geometry").GetProperty("coordinates");
            var coords = new List<double[]>(geom.GetArrayLength());
            foreach (var pair in geom.EnumerateArray())
            {
                coords.Add(new[] { pair[0].GetDouble(), pair[1].GetDouble() });
            }
            var meters = route.GetProperty("distance").GetDouble();
            var seconds = route.GetProperty("duration").GetDouble();
            return new RouteGeometry(coords,
                Math.Round(meters / 1000.0, 2),
                Math.Round(seconds / 60.0, 1));
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// From each source (lon, lat) to a single destination, returns the driving
    /// distance/duration. Order matches sources. Null on failure.
    /// </summary>
    public async Task<List<RouteMetric?>?> TableToDestinationAsync(
        IReadOnlyList<(double Lng, double Lat)> sources,
        (double Lng, double Lat) destination,
        CancellationToken ct = default)
    {
        if (sources.Count == 0) return new List<RouteMetric?>();

        var inv = CultureInfo.InvariantCulture;
        var coords = string.Join(";",
            sources.Select(s => $"{s.Lng.ToString(inv)},{s.Lat.ToString(inv)}")
                .Append($"{destination.Lng.ToString(inv)},{destination.Lat.ToString(inv)}"));

        var sourceIdx = string.Join(";", Enumerable.Range(0, sources.Count));
        var destIdx = sources.Count.ToString(inv);

        var url = $"{BaseUrl}/table/v1/driving/{coords}"
                  + $"?sources={sourceIdx}&destinations={destIdx}"
                  + "&annotations=distance,duration";

        try
        {
            using var response = await _http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode) return null;
            var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

            var root = doc.RootElement;
            if (root.GetProperty("code").GetString() != "Ok") return null;

            var distances = root.GetProperty("distances");
            var durations = root.GetProperty("durations");

            var result = new List<RouteMetric?>(sources.Count);
            for (int i = 0; i < sources.Count; i++)
            {
                var dRow = distances[i];
                var tRow = durations[i];
                if (dRow[0].ValueKind == JsonValueKind.Null || tRow[0].ValueKind == JsonValueKind.Null)
                {
                    result.Add(null);
                }
                else
                {
                    var meters = dRow[0].GetDouble();
                    var seconds = tRow[0].GetDouble();
                    result.Add(new RouteMetric(
                        Math.Round(meters / 1000.0, 2),
                        Math.Round(seconds / 60.0, 1)));
                }
            }
            return result;
        }
        catch
        {
            return null;
        }
    }
}
