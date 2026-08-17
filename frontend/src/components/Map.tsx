import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Incident {
    id: number;
    type: string;
    severity: number;
    status: string;
    latitude: number;
    longitude: number;
}

interface Vehicle {
    id: number;
    name: string;
    type: string;
    status: string;
    latitude: number;
    longitude: number;
    heading?: number | null;
}

export interface AssignmentLine {
    id: number;
    /** Bumped by the backend when the route is recomputed → replay the draw. */
    version: number;
    from: [number, number];
    to: [number, number];
    path?: [number, number][];
}

export interface LayerVisibility {
    incidents: boolean;
    vehicles: boolean;
    routes: boolean;
    heat: boolean;
}

export interface MapHandle {
    flyTo: (lng: number, lat: number) => void;
    fitAll: () => void;
}

interface MapProps {
    incidents: Incident[];
    vehicles: Vehicle[];
    assignments: AssignmentLine[];
    visibility: LayerVisibility;
    selectedIncidentId: number | null;
    selectedVehicleId: number | null;
    onVehicleMoved: (id: number, latitude: number, longitude: number) => void;
    onIncidentClick: (incident: Incident) => void;
    onVehicleClick: (vehicle: Vehicle) => void;
}

const DARK_STYLE =
    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const DRAW_DURATION_MS = 1100;
/** Simulator tick spacing — how long a marker takes to glide to its new fix. */
const VEHICLE_LERP_MS = 1200;

function sliceLine(coords: [number, number][], fraction: number): [number, number][] {
    if (fraction >= 1 || coords.length < 2) return coords;
    if (fraction <= 0) return [coords[0], coords[0]];
    let total = 0;
    const segLens: number[] = [];
    for (let i = 1; i < coords.length; i++) {
        const l = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
        segLens.push(l);
        total += l;
    }
    const target = total * fraction;
    let acc = 0;
    const out: [number, number][] = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
        const segLen = segLens[i - 1];
        if (acc + segLen >= target) {
            const t = segLen === 0 ? 0 : (target - acc) / segLen;
            out.push([
                coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
                coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t,
            ]);
            return out;
        }
        out.push(coords[i]);
        acc += segLen;
    }
    return out;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function severityColor(severity: number): string {
    if (severity >= 4) return "#f2555a";
    if (severity === 3) return "#f97316";
    return "#f5a524";
}

function vehicleColor(status: string): string {
    return status.toLowerCase() === "dispatched" ? "#f5a524" : "#2dd4e8";
}

const Map = forwardRef<MapHandle, MapProps>(function Map(props, ref) {
    const {
        incidents, vehicles, assignments, visibility,
        selectedIncidentId, selectedVehicleId,
        onVehicleMoved, onIncidentClick, onVehicleClick,
    } = props;

    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const styleReadyRef = useRef(false);
    const initialFitDoneRef = useRef(false);

    // Marker stores, keyed by entity id, so we mutate instead of recreating.
    const vMarkers = useRef(new window.Map<number, maplibregl.Marker>()).current;
    const iMarkers = useRef(new window.Map<number, maplibregl.Marker>()).current;
    /** Marker currently being dragged — never snap it from incoming updates. */
    const draggingRef = useRef<number | null>(null);

    // Latest props for the RAF loop, which is started once and never restarted.
    const dataRef = useRef({ assignments, visibility });
    dataRef.current = { assignments, visibility };
    // Callbacks change identity across renders; markers read them via a ref.
    const cbRef = useRef({ onVehicleMoved, onIncidentClick, onVehicleClick });
    cbRef.current = { onVehicleMoved, onIncidentClick, onVehicleClick };
    // Entity snapshots for click handlers (avoids stale closures).
    const entRef = useRef({ incidents, vehicles });
    entRef.current = { incidents, vehicles };

    const drawStartRef = useRef<Record<number, number>>({});
    const drawVersionRef = useRef<Record<number, number>>({});
    const dashOffsetRef = useRef(0);

    /**
     * Per-vehicle interpolation state. The simulator pushes a position roughly
     * once per second; without this the markers hop between those samples. We
     * ease from the last drawn position to the newest one every frame instead.
     */
    const vAnimRef = useRef(new window.Map<number, {
        fromLng: number; fromLat: number;
        toLng: number; toLat: number;
        start: number; duration: number;
        lng: number; lat: number;
    }>()).current;

    useImperativeHandle(ref, () => ({
        flyTo: (lng, lat) => {
            mapRef.current?.flyTo({ center: [lng, lat], zoom: 13.5, duration: 700 });
        },
        fitAll: () => fitAll(mapRef.current, entRef.current.incidents, entRef.current.vehicles),
    }));

    // ---- Map init (once) ---------------------------------------------------
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        const m = new maplibregl.Map({
            container: mapContainer.current,
            style: DARK_STYLE,
            center: [28.9784, 41.0082],
            zoom: 10,
            attributionControl: { compact: true },
        });
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

        m.on("load", () => {
            styleReadyRef.current = true;

            m.addSource("incidents-heat", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });
            m.addLayer({
                id: "incidents-heat-layer",
                type: "heatmap",
                source: "incidents-heat",
                layout: { visibility: "none" },
                paint: {
                    "heatmap-weight": ["interpolate", ["linear"], ["get", "severity"], 1, 0.2, 5, 1],
                    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 15, 3],
                    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 22, 15, 65],
                    "heatmap-opacity": 0.7,
                    "heatmap-color": [
                        "interpolate", ["linear"], ["heatmap-density"],
                        0, "rgba(0,0,0,0)",
                        0.25, "rgba(45,212,232,0.45)",
                        0.55, "rgba(245,165,36,0.65)",
                        1, "rgba(242,85,90,0.85)",
                    ],
                },
            });

            m.addSource("routes", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });
            m.addLayer({
                id: "routes-glow", type: "line", source: "routes",
                layout: { "line-cap": "round", "line-join": "round" },
                paint: { "line-color": "#2dd4e8", "line-width": 9, "line-opacity": 0.14, "line-blur": 5 },
            });
            m.addLayer({
                id: "routes-line", type: "line", source: "routes",
                layout: { "line-cap": "round", "line-join": "round" },
                paint: { "line-color": "#2dd4e8", "line-width": 3, "line-opacity": 0.9 },
            });
            m.addLayer({
                id: "routes-chase", type: "line", source: "routes",
                layout: { "line-cap": "butt", "line-join": "round" },
                paint: {
                    "line-color": "#eafcff", "line-width": 2,
                    "line-opacity": 0.85, "line-dasharray": [0.4, 3],
                },
            });
        });

        mapRef.current = m;

        // Single RAF loop for the lifetime of the map; reads dataRef.
        let raf = 0;
        const step = (ts: number) => {
            raf = requestAnimationFrame(step);
            if (!styleReadyRef.current) return;
            const src = m.getSource("routes") as maplibregl.GeoJSONSource | undefined;
            if (!src) return;

            // Glide vehicle markers between simulator fixes.
            for (const [id, anim] of vAnimRef) {
                const mk = vMarkers.get(id);
                if (!mk || draggingRef.current === id) continue;
                const t = anim.duration > 0
                    ? Math.min(1, (ts - anim.start) / anim.duration)
                    : 1;
                const lng = anim.fromLng + (anim.toLng - anim.fromLng) * t;
                const lat = anim.fromLat + (anim.toLat - anim.fromLat) * t;
                if (lng !== anim.lng || lat !== anim.lat) {
                    anim.lng = lng;
                    anim.lat = lat;
                    mk.setLngLat([lng, lat]);
                }
            }

            const { assignments: lines } = dataRef.current;
            const live = new Set(lines.map((a) => a.id));
            for (const k of Object.keys(drawStartRef.current)) {
                if (!live.has(Number(k))) {
                    delete drawStartRef.current[Number(k)];
                    delete drawVersionRef.current[Number(k)];
                }
            }

            const features = lines.map((a) => {
                const full = a.path && a.path.length >= 2 ? a.path : [a.from, a.to];
                // Re-animate only on a real reroute (version bump), not on every
                // simulator tick that merely shortens the remaining path.
                if (drawVersionRef.current[a.id] !== a.version) {
                    drawVersionRef.current[a.id] = a.version;
                    drawStartRef.current[a.id] = ts;
                }
                const elapsed = ts - (drawStartRef.current[a.id] ?? ts);
                const t = Math.min(1, elapsed / DRAW_DURATION_MS);
                return {
                    type: "Feature" as const,
                    properties: { id: a.id },
                    geometry: {
                        type: "LineString" as const,
                        coordinates: sliceLine(full, easeOutCubic(t)),
                    },
                };
            });
            src.setData({ type: "FeatureCollection", features });

            if (features.length > 0 && m.getLayer("routes-chase")) {
                dashOffsetRef.current = (dashOffsetRef.current + 0.07) % 3.4;
                const off = dashOffsetRef.current;
                m.setPaintProperty("routes-chase", "line-dasharray",
                    [0.4, Math.max(0.05, 3 - off), 0.4, off]);
            }
        };
        raf = requestAnimationFrame(step);

        return () => {
            cancelAnimationFrame(raf);
            m.remove();
            mapRef.current = null;
            styleReadyRef.current = false;
            initialFitDoneRef.current = false;
            vMarkers.clear();
            iMarkers.clear();
        };
    }, [vMarkers, iMarkers, vAnimRef]);

    // ---- Layer visibility --------------------------------------------------
    useEffect(() => {
        const m = mapRef.current;
        if (!m) return;
        const apply = () => {
            const set = (id: string, on: boolean) => {
                if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
            };
            set("routes-glow", visibility.routes);
            set("routes-line", visibility.routes);
            set("routes-chase", visibility.routes);
            set("incidents-heat-layer", visibility.heat);
            vMarkers.forEach((mk) => {
                mk.getElement().style.visibility = visibility.vehicles ? "visible" : "hidden";
            });
            iMarkers.forEach((mk) => {
                mk.getElement().style.visibility = visibility.incidents ? "visible" : "hidden";
            });
        };
        if (styleReadyRef.current) apply();
        else m.once("load", apply);
    }, [visibility, vMarkers, iMarkers]);

    // ---- Incident markers (diffed) -----------------------------------------
    useEffect(() => {
        const m = mapRef.current;
        if (!m) return;
        const alive = new Set<number>();

        for (const inc of incidents) {
            alive.add(inc.id);
            let mk = iMarkers.get(inc.id);
            if (!mk) {
                const el = document.createElement("div");
                el.style.cursor = "pointer";
                el.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const fresh = entRef.current.incidents.find((x) => x.id === inc.id);
                    if (fresh) cbRef.current.onIncidentClick(fresh);
                });
                mk = new maplibregl.Marker({ element: el })
                    .setLngLat([inc.longitude, inc.latitude])
                    .setPopup(new maplibregl.Popup({ closeButton: false, offset: 12 }))
                    .addTo(m);
                iMarkers.set(inc.id, mk);
            } else {
                mk.setLngLat([inc.longitude, inc.latitude]);
            }

            const el = mk.getElement();
            const resolved = inc.status === "Resolved";
            const color = resolved ? "#5a6875" : severityColor(inc.severity);
            const size = 11 + inc.severity * 2;
            const selected = selectedIncidentId === inc.id;
            const sig = `${color}|${size}|${selected}|${resolved}`;
            if (el.dataset.sig !== sig) {
                el.dataset.sig = sig;
                el.style.width = `${size}px`;
                el.style.height = `${size}px`;
                el.style.borderRadius = "50%";
                el.style.background = color;
                el.style.border = "2px solid #080b10";
                el.style.opacity = resolved ? "0.42" : "1";
                el.style.boxShadow = selected
                    ? `0 0 0 3px rgba(45,212,232,0.85), 0 0 16px ${color}`
                    : `0 0 10px ${color}`;
                el.style.transition = "box-shadow 140ms, opacity 140ms";
            }
            mk.getPopup()?.setText(`${inc.type} · Sev ${inc.severity} · ${inc.status}`);
        }

        for (const [id, mk] of iMarkers) {
            if (!alive.has(id)) { mk.remove(); iMarkers.delete(id); }
        }
    }, [incidents, selectedIncidentId, iMarkers]);

    // ---- Vehicle markers (diffed, drag-safe) -------------------------------
    useEffect(() => {
        const m = mapRef.current;
        if (!m) return;
        const alive = new Set<number>();

        for (const v of vehicles) {
            alive.add(v.id);
            let mk = vMarkers.get(v.id);
            if (!mk) {
                const el = document.createElement("div");
                el.style.cursor = "grab";
                el.style.width = "22px";
                el.style.height = "22px";
                el.style.transition = "filter 140ms";
                el.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const fresh = entRef.current.vehicles.find((x) => x.id === v.id);
                    if (fresh) cbRef.current.onVehicleClick(fresh);
                });
                mk = new maplibregl.Marker({ element: el, draggable: true })
                    .setLngLat([v.longitude, v.latitude])
                    .setPopup(new maplibregl.Popup({ closeButton: false, offset: 14 }))
                    .addTo(m);
                mk.on("dragstart", () => { draggingRef.current = v.id; });
                mk.on("dragend", () => {
                    draggingRef.current = null;
                    const p = mk!.getLngLat();
                    cbRef.current.onVehicleMoved(v.id, p.lat, p.lng);
                });
                vMarkers.set(v.id, mk);
                vAnimRef.set(v.id, {
                    fromLng: v.longitude, fromLat: v.latitude,
                    toLng: v.longitude, toLat: v.latitude,
                    start: performance.now(), duration: 0,
                    lng: v.longitude, lat: v.latitude,
                });
            } else if (draggingRef.current !== v.id) {
                // Never yank a marker out from under the user's cursor.
                const anim = vAnimRef.get(v.id);
                if (!anim) {
                    mk.setLngLat([v.longitude, v.latitude]);
                } else if (anim.toLng !== v.longitude || anim.toLat !== v.latitude) {
                    const hop = Math.hypot(v.longitude - anim.lng, v.latitude - anim.lat);
                    // A drag or a reroute teleports the vehicle — snap those; only
                    // ease the small simulator steps.
                    const snap = hop > 0.05;
                    anim.fromLng = snap ? v.longitude : anim.lng;
                    anim.fromLat = snap ? v.latitude : anim.lat;
                    anim.toLng = v.longitude;
                    anim.toLat = v.latitude;
                    anim.start = performance.now();
                    anim.duration = snap ? 0 : VEHICLE_LERP_MS;
                }
            }

            const el = mk.getElement();
            const color = vehicleColor(v.status);
            const heading = Math.round(v.heading ?? 0);
            const selected = selectedVehicleId === v.id;
            const sig = `${color}|${heading}|${selected}`;
            if (el.dataset.sig !== sig) {
                el.dataset.sig = sig;
                el.style.filter = selected
                    ? `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 3px #fff)`
                    : `drop-shadow(0 0 4px ${color})`;
                // Rotate the SVG, not the marker root: MapLibre owns the root's
                // transform for positioning and would fight us for it.
                el.innerHTML = `<svg viewBox="0 0 22 22" width="22" height="22"
                        style="transform: rotate(${heading}deg); transition: transform 400ms linear">
                    <path d="M11 2 L18 19 L11 15.2 L4 19 Z" fill="${color}"
                        stroke="${selected ? "#ffffff" : "#080b10"}" stroke-width="1.6"
                        stroke-linejoin="round"/></svg>`;
            }
            mk.getPopup()?.setText(`${v.name} · ${v.type} · ${v.status}`);
        }

        for (const [id, mk] of vMarkers) {
            if (!alive.has(id)) { mk.remove(); vMarkers.delete(id); vAnimRef.delete(id); }
        }
    }, [vehicles, selectedVehicleId, vMarkers, vAnimRef]);

    // ---- Heatmap data ------------------------------------------------------
    useEffect(() => {
        const m = mapRef.current;
        if (!m) return;
        const apply = () => {
            const src = m.getSource("incidents-heat") as maplibregl.GeoJSONSource | undefined;
            if (!src) return;
            src.setData({
                type: "FeatureCollection",
                features: incidents.filter((i) => i.status !== "Resolved").map((i) => ({
                    type: "Feature",
                    properties: { severity: i.severity },
                    geometry: { type: "Point", coordinates: [i.longitude, i.latitude] },
                })),
            });
        };
        if (styleReadyRef.current) apply();
        else m.once("load", apply);
    }, [incidents]);

    // ---- Initial zoom-to-fit ----------------------------------------------
    useEffect(() => {
        const m = mapRef.current;
        if (!m || initialFitDoneRef.current) return;
        if (incidents.length === 0 && vehicles.length === 0) return;
        const run = () => {
            fitAll(m, incidents, vehicles);
            initialFitDoneRef.current = true;
        };
        if (styleReadyRef.current) run();
        else m.once("load", run);
    }, [incidents, vehicles]);

    return <div ref={mapContainer} className="map-container" />;
});

function fitAll(m: maplibregl.Map | null, incidents: Incident[], vehicles: Vehicle[]) {
    if (!m) return;
    const pts: [number, number][] = [
        ...incidents.map((i) => [i.longitude, i.latitude] as [number, number]),
        ...vehicles.map((v) => [v.longitude, v.latitude] as [number, number]),
    ];
    if (pts.length === 0) return;
    const bounds = pts.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
    m.fitBounds(bounds, { padding: 70, duration: 800, maxZoom: 13 });
}

export default Map;
