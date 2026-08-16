namespace KUT.Api.Services;

/// <summary>
/// Simple mapping from incident type → required vehicle capability tag(s).
/// Score 2 = perfect match, 1 = partial (kurtarma umbrella), 0 = no match.
/// </summary>
public static class CompatibilityMatrix
{
    private static readonly Dictionary<string, string[]> Required = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Yangın"]         = new[] { "yangin", "merdivenli" },
        ["Trafik Kazası"]  = new[] { "kurtarma", "arama-kurtarma", "merdivenli" },
        ["Bina Çökmesi"]   = new[] { "arama-kurtarma", "merdivenli" },
        ["Su Baskını"]     = new[] { "kurtarma", "arama-kurtarma" },
    };

    public static int Score(string incidentType, string vehicleCapabilities)
    {
        if (!Required.TryGetValue(incidentType, out var wanted)) return 1; // unknown incident type → neutral
        if (string.IsNullOrWhiteSpace(vehicleCapabilities)) return 0;
        var caps = vehicleCapabilities.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (caps.Length == 0) return 0;

        var primary = wanted[0];
        var hasPrimary = caps.Any(c => c.Equals(primary, StringComparison.OrdinalIgnoreCase));
        if (hasPrimary) return 2;

        var hasAny = caps.Any(c => wanted.Any(w => c.Equals(w, StringComparison.OrdinalIgnoreCase)));
        return hasAny ? 1 : 0;
    }
}
