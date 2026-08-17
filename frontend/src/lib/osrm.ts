// OSRM public router — free demo endpoint. Fine for dev; swap for a self-hosted
// OSRM/Valhalla in production. Returns [lng, lat] coordinate list for a driving
// route, or null on failure (caller should fall back to a straight line).
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

const cache = new Map<string, [number, number][]>();

function key(from: [number, number], to: [number, number]) {
    return `${from[0].toFixed(5)},${from[1].toFixed(5)}|${to[0].toFixed(5)},${to[1].toFixed(5)}`;
}

export async function fetchRoute(
    from: [number, number],
    to: [number, number]
): Promise<[number, number][] | null> {
    const k = key(from, to);
    const cached = cache.get(k);
    if (cached) return cached;

    const url = `${OSRM_BASE}/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        const coords: [number, number][] | undefined =
            json?.routes?.[0]?.geometry?.coordinates;
        if (!coords || coords.length < 2) return null;
        cache.set(k, coords);
        return coords;
    } catch {
        return null;
    }
}
