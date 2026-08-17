const TYPES = ["Yangın", "Trafik Kazası", "Bina Çökmesi", "Su Baskını"];

/** Istanbul-ish random bounding box; keeps demo incidents visible on screen. */
export function randomInIstanbul(): [number, number] {
    const lng = 28.85 + Math.random() * 0.35;
    const lat = 40.95 + Math.random() * 0.15;
    return [lng, lat];
}

/** Fire-and-forget POST for the top-bar "Rastgele" button. */
export function postRandomIncident(apiBase: string): Promise<Response> {
    const [lng, lat] = randomInIstanbul();
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const severity = 1 + Math.floor(Math.random() * 5);
    return fetch(`${apiBase}/api/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, severity, latitude: lat, longitude: lng }),
    });
}

export { TYPES as INCIDENT_TYPES };
