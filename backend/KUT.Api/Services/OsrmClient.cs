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
    private readonly ILogger<OsrmClient> _logger;
    // Public OSRM instances, tried in order. FOSSGIS first: it runs the same
    // car profile but holds up far better than the project-osrm demo box, which
    // is the one that used to rate-limit us into straight lines.
    private static readonly string[] BaseUrls =
    {
        "https://routing.openstreetmap.de/routed-car",
        "https://router.project-osrm.org",
    };
    // Transient 429/5xx/timeouts are common on public boxes; a couple of quick
    // retries turn most of them into a real route instead of a fallback.
    private const int MaxAttempts = 2;
    // Snap radius (m) for the vehicle/incident pins — without it OSRM rejects
    // any point that isn't within its default snapping distance of a road.
    private const int SnapRadiusMeters = 2000;
    // Resample step (m) for the stored polyline. OSRM emits a vertex per road
    // geometry change: dense in junctions, hundreds of metres apart on a
    // motorway. Resampling to a fixed step makes the simulated vehicle move at
    // an even pace instead of teleporting down straight stretches.
    private const double ResampleStepMeters = 25.0;
    // Guard against pathological polylines on very long routes.
    private const int MaxPolylinePoints = 6000;

    public OsrmClient(HttpClient http, ILogger<OsrmClient> logger)
    {
        _http = http;
        _logger = logger;
        _http.Timeout = TimeSpan.FromSeconds(12);
        // The demo server drops requests without a UA.
        if (!_http.DefaultRequestHeaders.Contains("User-Agent"))
        {
            _http.DefaultRequestHeaders.Add("User-Agent", "KUT-Dispatch/1.0");
        }
    }

    /// <summary>
    /// GET <paramref name="path"/> from each router in turn, with a couple of
    /// retries each — transient 429/5xx/timeouts on the public boxes are the
    /// usual reason a dispatch ends up with no geometry at all.
    /// </summary>
    private async Task<JsonDocument?> GetJsonAsync(string path, CancellationToken ct)
    {
        foreach (var baseUrl in BaseUrls)
        {
            for (int attempt = 1; attempt <= MaxAttempts; attempt++)
            {
                try
                {
                    using var response = await _http.GetAsync(baseUrl + path, ct);
                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("OSRM {Status} from {Host} (attempt {Attempt}/{Max})",
                            (int)response.StatusCode, baseUrl, attempt, MaxAttempts);
                    }
                    else
                    {
                        var stream = await response.Content.ReadAsStreamAsync(ct);
                        return await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
                {
                    _logger.LogWarning(ex, "OSRM request to {Host} failed (attempt {Attempt}/{Max})",
                        baseUrl, attempt, MaxAttempts);
                }

                if (ct.IsCancellationRequested) return null;
                if (attempt < MaxAttempts)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(300 * attempt), ct);
                }
            }
        }
        _logger.LogWarning("All OSRM routers failed for {Path}", path);
        return null;
    }

    public record RouteMetric(double DistanceKm, double DurationMin);
    public record RouteGeometry(List<double[]> Coordinates, double DistanceKm, double DurationMin);

    /// <summary>
    /// Full driving route from one point to another, along real roads.
    ///
    /// Asks OSRM for alternatives and picks the one a dispatcher would pick:
    /// fastest wins (that is what "en hızlı yol" means for a response vehicle),
    /// but a marginally slower route that is meaningfully shorter beats a
    /// detour that only wins on paper — see <see cref="Cost"/>. The chosen
    /// polyline is then resampled to an even step so the vehicle animates at a
    /// believable pace. Null on failure. Coordinates are [lng, lat] pairs.
    /// </summary>
    public async Task<RouteGeometry?> RouteAsync(
        (double Lng, double Lat) from,
        (double Lng, double Lat) to,
        CancellationToken ct = default)
    {
        var inv = CultureInfo.InvariantCulture;
        var path = "/route/v1/driving/"
                   + $"{from.Lng.ToString(inv)},{from.Lat.ToString(inv)};"
                   + $"{to.Lng.ToString(inv)},{to.Lat.ToString(inv)}"
                   + "?geometries=geojson&overview=full"
                   // Ask for alternatives and let OSRM leave the initial road if
                   // doubling back is genuinely faster (a U-turn a driver would make).
                   + "&alternatives=3&continue_straight=false"
                   // Snap both pins to the nearest road instead of failing, and
                   // arrive on the driving side of the destination.
                   + $"&radiuses={SnapRadiusMeters};{SnapRadiusMeters}"
                   + "&approaches=unrestricted;curb";

        using var doc = await GetJsonAsync(path, ct);
        if (doc == null) return null;

        try
        {
            var root = doc.RootElement;
            if (!root.TryGetProperty("code", out var code) || code.GetString() != "Ok")
            {
                _logger.LogWarning("OSRM route rejected: {Code}",
                    root.TryGetProperty("code", out var c) ? c.GetString() : "no-code");
                return null;
            }

            RouteGeometry? best = null;
            var considered = 0;
            foreach (var route in root.GetProperty("routes").EnumerateArray())
            {
                var geom = route.GetProperty("geometry").GetProperty("coordinates");
                if (geom.GetArrayLength() < 2) continue;

                var coords = new List<double[]>(geom.GetArrayLength());
                foreach (var pair in geom.EnumerateArray())
                {
                    coords.Add(new[] { pair[0].GetDouble(), pair[1].GetDouble() });
                }

                var meters = route.GetProperty("distance").GetDouble();
                var seconds = route.GetProperty("duration").GetDouble();
                if (meters <= 0 || seconds <= 0) continue;

                considered++;
                var candidate = new RouteGeometry(coords,
                    Math.Round(meters / 1000.0, 2),
                    Math.Round(seconds / 60.0, 1));

                if (best == null || Cost(candidate) < Cost(best)) best = candidate;
            }

            if (best == null)
            {
                _logger.LogWarning("OSRM returned no usable route geometry");
                return null;
            }

            var smoothed = Resample(best.Coordinates, best.DistanceKm * 1000.0);
            _logger.LogInformation(
                "Route picked: {Km} km / {Min} min from {Count} alternative(s), {Points} points",
                best.DistanceKm, best.DurationMin, considered, smoothed.Count);
            return best with { Coordinates = smoothed };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OSRM route response could not be parsed");
            return null;
        }
    }

    /// <summary>
    /// Ranking cost in seconds: travel time, plus a small penalty per extra
    /// kilometre. Keeps "fastest" as the primary criterion while breaking near
    /// ties in favour of the shorter, more direct road — which is what actually
    /// looks right on the map.
    /// </summary>
    private static double Cost(RouteGeometry r) => r.DurationMin * 60.0 + r.DistanceKm * 6.0;

    /// <summary>
    /// Walks the polyline and emits a point roughly every
    /// <see cref="ResampleStepMeters"/>, keeping the exact start and end. Dense
    /// corner geometry is preserved (short segments pass through untouched);
    /// long straight runs get intermediate points so index-based animation
    /// tracks real distance instead of vertex count.
    /// </summary>
    private static List<double[]> Resample(List<double[]> coords, double totalMeters)
    {
        if (coords.Count < 2) return coords;

        // Never blow past the point budget on a long intercity route.
        var step = Math.Max(ResampleStepMeters, totalMeters / MaxPolylinePoints);

        var result = new List<double[]> { coords[0] };
        for (int i = 1; i < coords.Count; i++)
        {
            var a = result[^1];
            var b = coords[i];
            var segment = HaversineMeters(a[1], a[0], b[1], b[0]);
            if (segment > step)
            {
                var splits = (int)(segment / step);
                for (int s = 1; s <= splits; s++)
                {
                    var t = s * step / segment;
                    if (t >= 1) break;
                    result.Add(new[] { a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t });
                }
            }
            result.Add(b);
        }
        return result;
    }

    public static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000.0;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180)
                * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * R * Math.Asin(Math.Min(1, Math.Sqrt(a)));
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

        var path = $"/table/v1/driving/{coords}"
                   + $"?sources={sourceIdx}&destinations={destIdx}"
                   + "&annotations=distance,duration";

        using var doc = await GetJsonAsync(path, ct);
        if (doc == null) return null;

        try
        {
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
