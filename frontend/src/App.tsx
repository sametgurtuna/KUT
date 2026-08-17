import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import "./App.css";
import Map from "./components/Map";
import type { AssignmentLine, LayerVisibility, MapHandle } from "./components/Map";
import MapOverlay from "./components/MapOverlay";
import TopBar from "./components/TopBar";
import type { ConnState } from "./components/TopBar";
import ResourceTree from "./components/ResourceTree";
import type { TreeVehicle } from "./components/ResourceTree";
import EventFeed from "./components/EventFeed";
import type { EventContext, FeedEvent } from "./components/EventFeed";
import RecommendationsPanel from "./components/RecommendationsPanel";
import type { Recommendation, SelectedIncident } from "./components/RecommendationsPanel";
import AssignmentsPanel from "./components/AssignmentsPanel";
import type { ActiveAssignment } from "./components/AssignmentsPanel";
import Timeline from "./components/Timeline";
import GraphPanel from "./components/GraphPanel";
import Toaster from "./components/Toaster";
import NewIncidentModal from "./components/NewIncidentModal";
import NewVehicleModal from "./components/NewVehicleModal";
import { postRandomIncident } from "./lib/randomIncident";
import { toast } from "./lib/toast";

const API_BASE = "http://localhost:5144";

interface Incident {
    id: number; type: string; severity: number; status: string;
    latitude: number; longitude: number; createdAt: string;
}

interface Vehicle {
    id: number; name: string; type: string; status: string;
    latitude: number; longitude: number; heading?: number | null;
}

interface AssignmentDto {
    id: number; incidentId: number; vehicleId: number; status: string;
    createdAt: string; etaSeconds: number | null;
    routePath: string | null; routeIndex: number; routeVersion: number;
    vehicle?: Vehicle; incident?: Incident;
}

type RightTab = "events" | "recs" | "assigns" | "graph";
type ModalKind = null | "new-incident" | "new-vehicle";

function safeJson<T>(s: string | null): T | null {
    if (!s) return null;
    try { return JSON.parse(s) as T; } catch { return null; }
}

function App() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [assignments, setAssignments] = useState<AssignmentDto[]>([]);
    const [events, setEvents] = useState<FeedEvent[]>([]);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [recsLoading, setRecsLoading] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState<SelectedIncident | null>(null);
    const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
    const [connState, setConnState] = useState<ConnState>("connecting");
    const [rightTab, setRightTab] = useState<RightTab>("events");
    const [structureKey, setStructureKey] = useState(0);
    const [graphKey, setGraphKey] = useState(0);
    const [visibility, setVisibility] = useState<LayerVisibility>({
        incidents: true, vehicles: true, routes: true, heat: false,
    });
    const [pinnedAt, setPinnedAt] = useState<number | null>(null);
    const [modal, setModal] = useState<ModalKind>(null);
    const [showLeft, setShowLeft] = useState(true);
    const [showRight, setShowRight] = useState(true);

    const mapRef = useRef<MapHandle>(null);

    const refetchAll = useCallback(() => {
        fetch(`${API_BASE}/api/incidents`).then((r) => r.json()).then(setIncidents).catch(() => {});
        fetch(`${API_BASE}/api/vehicles`).then((r) => r.json()).then(setVehicles).catch(() => {});
        fetch(`${API_BASE}/api/events?limit=200`).then((r) => r.json()).then(setEvents).catch(() => {});
        fetch(`${API_BASE}/api/assignments`).then((r) => r.json()).then(setAssignments).catch(() => {});
        setStructureKey((n) => n + 1);
        setGraphKey((n) => n + 1);
    }, []);

    useEffect(refetchAll, [refetchAll]);

    // ---- SignalR ----------------------------------------------------------
    useEffect(() => {
        const conn = new signalR.HubConnectionBuilder()
            .withUrl(`${API_BASE}/hub/kut`)
            .withAutomaticReconnect()
            .build();

        conn.on("VehicleUpdated", (v: Vehicle) => {
            setVehicles((prev) => prev.map((x) => (x.id === v.id ? v : x)));
        });
        conn.on("VehicleCreated", (v: Vehicle) => {
            setVehicles((prev) => [...prev.filter((x) => x.id !== v.id), v]);
            setStructureKey((n) => n + 1);
            setGraphKey((n) => n + 1);
            toast(`Araç eklendi: ${v.name}`, "success");
        });
        conn.on("IncidentCreated", (i: Incident) => {
            setIncidents((prev) => [i, ...prev.filter((x) => x.id !== i.id)]);
            setGraphKey((n) => n + 1);
            toast(`Yeni ihbar: ${i.type} · Şiddet ${i.severity}`, "warn");
        });
        conn.on("IncidentUpdated", (i: Incident) => {
            setIncidents((prev) => prev.map((x) => (x.id === i.id ? i : x)));
        });
        conn.on("AssignmentCreated", (a: AssignmentDto) => {
            setAssignments((prev) => [a, ...prev.filter((x) => x.id !== a.id)]);
            setGraphKey((n) => n + 1);
        });
        conn.on("AssignmentUpdated", (a: AssignmentDto) => {
            setAssignments((prev) => prev.map((x) => (x.id === a.id ? a : x)));
        });
        // Progress-only tick from the route simulator — cheap, no geometry.
        conn.on("AssignmentProgress", (p: { id: number; routeIndex: number; routeVersion: number }) => {
            setAssignments((prev) => prev.map((x) =>
                x.id === p.id ? { ...x, routeIndex: p.routeIndex, routeVersion: p.routeVersion } : x));
        });
        conn.on("AssignmentCancelled", (a: AssignmentDto) => {
            setAssignments((prev) => prev.map((x) => (x.id === a.id ? a : x)));
            setGraphKey((n) => n + 1);
        });
        conn.on("AssignmentResolved", (a: AssignmentDto) => {
            setAssignments((prev) => prev.map((x) => (x.id === a.id ? a : x)));
            setGraphKey((n) => n + 1);
        });
        conn.on("EventLogged", (e: FeedEvent) => {
            setEvents((prev) => (prev.some((x) => x.id === e.id) ? prev : [e, ...prev].slice(0, 400)));
        });

        conn.onreconnecting(() => { setConnState("reconnecting"); toast("Yeniden bağlanıyor…", "warn"); });
        conn.onreconnected(() => {
            setConnState("connected");
            toast("Bağlantı geri geldi", "success");
            refetchAll();
        });
        conn.onclose(() => { setConnState("disconnected"); toast("Bağlantı koptu", "error"); });

        conn.start().then(() => setConnState("connected")).catch(() => setConnState("disconnected"));
        return () => { conn.stop(); };
    }, [refetchAll]);

    // ---- Actions ----------------------------------------------------------
    const handleVehicleMoved = useCallback((id: number, latitude: number, longitude: number) => {
        fetch(`${API_BASE}/api/vehicles/${id}/location`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude, longitude }),
        }).catch(() => toast("Konum güncellenemedi", "error"));
    }, []);

    const loadRecs = useCallback((incidentId: number) => {
        setRecsLoading(true);
        fetch(`${API_BASE}/api/incidents/${incidentId}/recommendations`)
            .then((r) => r.json())
            .then((d) => { setRecommendations(d); setRecsLoading(false); })
            .catch(() => setRecsLoading(false));
    }, []);

    const handleIncidentClick = useCallback((inc: { id: number; type: string; severity: number }) => {
        setSelectedIncident({ id: inc.id, type: inc.type, severity: inc.severity });
        setSelectedVehicleId(null);
        setRightTab("recs");
        setShowRight(true);
        loadRecs(inc.id);
    }, [loadRecs]);

    const handleVehicleClick = useCallback((v: Vehicle) => {
        setSelectedVehicleId(v.id);
    }, []);

    const handleAssign = useCallback((incidentId: number, vehicleIds: number[]) => {
        Promise.all(vehicleIds.map((vid) =>
            fetch(`${API_BASE}/api/assignments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ incidentId, vehicleId: vid }),
            })
        )).then(() => {
            toast(vehicleIds.length === 1 ? "Araç atandı" : `${vehicleIds.length} araç atandı`, "success");
            loadRecs(incidentId);
        }).catch(() => toast("Atama başarısız", "error"));
    }, [loadRecs]);

    const handleCancelAssignment = useCallback((id: number) => {
        fetch(`${API_BASE}/api/assignments/${id}/cancel`, { method: "POST" })
            .then(() => toast("Atama iptal edildi", "info"))
            .catch(() => toast("İptal başarısız", "error"));
    }, []);

    const handleResolveAssignment = useCallback((id: number) => {
        fetch(`${API_BASE}/api/assignments/${id}/resolve`, { method: "POST" })
            .then(() => toast("Atama tamamlandı", "success"))
            .catch(() => toast("İşlem başarısız", "error"));
    }, []);

    const handleIncidentStatus = useCallback((incidentId: number, status: "InProgress" | "Resolved") => {
        fetch(`${API_BASE}/api/incidents/${incidentId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        }).then(() => toast(`İhbar durumu: ${status}`, "info"))
          .catch(() => toast("Durum güncellenemedi", "error"));
    }, []);

    const focusVehicle = useCallback((vehicleId: number) => {
        const v = vehicles.find((x) => x.id === vehicleId);
        if (v) { setSelectedVehicleId(v.id); mapRef.current?.flyTo(v.longitude, v.latitude); }
    }, [vehicles]);

    const focusIncident = useCallback((incidentId: number) => {
        const i = incidents.find((x) => x.id === incidentId);
        if (i) mapRef.current?.flyTo(i.longitude, i.latitude);
    }, [incidents]);

    const handleTreeFocus = useCallback((v: TreeVehicle) => focusVehicle(v.id), [focusVehicle]);

    const handleEventFocus = useCallback((e: FeedEvent) => {
        if (e.entityType === "Vehicle") focusVehicle(e.entityId);
        else if (e.entityType === "Incident") focusIncident(e.entityId);
        else if (e.entityType === "Assignment") {
            const p = safeJson<{ vehicleId?: number }>(e.payload);
            if (p?.vehicleId) focusVehicle(p.vehicleId);
        }
    }, [focusVehicle, focusIncident]);

    const toggleLayer = useCallback((key: keyof LayerVisibility) => {
        setVisibility((v) => ({ ...v, [key]: !v[key] }));
    }, []);

    const handleClearEvents = useCallback(() => {
        setEvents([]);
        toast("Görüntü temizlendi (kayıtlar sunucuda duruyor)", "info", 2200);
    }, []);

    // Recommendations go stale when vehicle statuses change — refresh quietly.
    const vehicleStatusKey = useMemo(
        () => vehicles.map((v) => `${v.id}:${v.status}`).join(","),
        [vehicles]
    );
    useEffect(() => {
        if (selectedIncident) loadRecs(selectedIncident.id);
    }, [vehicleStatusKey, selectedIncident, loadRecs]);

    // ---- Timeline replay derivation ---------------------------------------
    const isReplay = pinnedAt != null;

    const displayIncidents = useMemo<Incident[]>(() => {
        if (!isReplay) return incidents;
        const cutoff = pinnedAt!;
        return incidents
            .filter((i) => new Date(i.createdAt).getTime() <= cutoff)
            .map((i) => {
                const laterChange = events.some((e) =>
                    (e.eventType === "INCIDENT_RESOLVED" || e.eventType === "INCIDENT_STATUS_CHANGED")
                    && e.entityType === "Incident" && e.entityId === i.id
                    && new Date(e.timestamp).getTime() > cutoff);
                return laterChange ? { ...i, status: "Open" } : i;
            });
    }, [isReplay, pinnedAt, incidents, events]);

    const displayVehicles = useMemo<Vehicle[]>(() => {
        if (!isReplay) return vehicles;
        const cutoff = pinnedAt!;
        return vehicles.map((v) => {
            // events are newest-first, so the first match is the latest ≤ cutoff.
            const moved = events.find((e) =>
                e.eventType === "VEHICLE_MOVED" && e.entityType === "Vehicle"
                && e.entityId === v.id && new Date(e.timestamp).getTime() <= cutoff);
            const p = moved ? safeJson<{ latitude: number; longitude: number }>(moved.payload) : null;
            return p ? { ...v, latitude: p.latitude, longitude: p.longitude } : v;
        });
    }, [isReplay, pinnedAt, vehicles, events]);

    const displayAssignments = useMemo<AssignmentDto[]>(() => {
        if (!isReplay) return assignments;
        const cutoff = pinnedAt!;
        return assignments
            .filter((a) => new Date(a.createdAt).getTime() <= cutoff)
            .map((a) => {
                const endedBefore = events.some((e) =>
                    (e.eventType === "INCIDENT_RESOLVED" || e.eventType === "VEHICLE_RELEASED")
                    && e.entityType === "Assignment" && e.entityId === a.id
                    && new Date(e.timestamp).getTime() <= cutoff);
                return { ...a, status: endedBefore ? "Ended" : "Active" };
            });
    }, [isReplay, pinnedAt, assignments, events]);

    // ---- Route lines: geometry comes from the backend, sliced by progress ---
    const assignmentLines: AssignmentLine[] = useMemo(() => {
        const out: AssignmentLine[] = [];
        for (const a of displayAssignments) {
            if (a.status !== "Active") continue;
            const v = displayVehicles.find((x) => x.id === a.vehicleId);
            const i = displayIncidents.find((x) => x.id === a.incidentId);
            if (!v || !i) continue;

            let path: [number, number][] | undefined;
            if (!isReplay) {
                const all = safeJson<[number, number][]>(a.routePath);
                if (all && all.length >= 2) {
                    const idx = Math.max(0, Math.min(a.routeIndex ?? 0, all.length - 2));
                    path = all.slice(idx);
                }
            }
            out.push({
                id: a.id,
                version: a.routeVersion ?? 0,
                from: [v.longitude, v.latitude],
                to: [i.longitude, i.latitude],
                path,
            });
        }
        return out;
    }, [displayAssignments, displayVehicles, displayIncidents, isReplay]);

    const activeAssignments: ActiveAssignment[] = useMemo(() =>
        assignments.filter((a) => a.status === "Active").map((a) => {
            const all = safeJson<[number, number][]>(a.routePath);
            const progress = all && all.length > 1
                ? Math.min(1, (a.routeIndex ?? 0) / (all.length - 1))
                : 0;
            return {
                id: a.id,
                incidentId: a.incidentId,
                vehicleId: a.vehicleId,
                vehicleName: vehicles.find((x) => x.id === a.vehicleId)?.name
                    ?? a.vehicle?.name ?? `#${a.vehicleId}`,
                incidentType: incidents.find((x) => x.id === a.incidentId)?.type
                    ?? a.incident?.type ?? "?",
                incidentSeverity: incidents.find((x) => x.id === a.incidentId)?.severity
                    ?? a.incident?.severity ?? 0,
                createdAt: a.createdAt,
                etaSeconds: a.etaSeconds,
                progress,
            };
        }), [assignments, vehicles, incidents]);

    const displayedEvents = useMemo(() =>
        pinnedAt == null ? events
            : events.filter((e) => new Date(e.timestamp).getTime() <= pinnedAt),
        [events, pinnedAt]);

    const eventCtx: EventContext = useMemo(() => ({
        vehicleNames: Object.fromEntries(vehicles.map((v) => [v.id, v.name])),
        incidentNames: Object.fromEntries(incidents.map((i) => [i.id, `${i.type} #${i.id}`])),
        assignmentRefs: Object.fromEntries(
            assignments.map((a) => [a.id, { vehicleId: a.vehicleId, incidentId: a.incidentId }])),
    }), [vehicles, incidents, assignments]);

    const selectedIncidentStatus = useMemo(() =>
        selectedIncident ? (incidents.find((i) => i.id === selectedIncident.id)?.status ?? null) : null,
        [selectedIncident, incidents]);

    const mapCenter: [number, number] = useMemo(() => {
        if (incidents.length > 0) return [incidents[0].longitude, incidents[0].latitude];
        if (vehicles.length > 0) return [vehicles[0].longitude, vehicles[0].latitude];
        return [28.9784, 41.0082];
    }, [incidents, vehicles]);

    const openCount = incidents.filter((i) => i.status !== "Resolved").length;
    const availableCount = vehicles.filter((v) => v.status === "Available").length;

    const shellClass = [
        "app-shell",
        showLeft ? "" : "hide-left",
        showRight ? "" : "hide-right",
    ].filter(Boolean).join(" ");

    return (
        <div className={shellClass}>
            <TopBar
                connState={connState}
                showLeft={showLeft}
                showRight={showRight}
                onToggleLeft={() => setShowLeft((s) => !s)}
                onToggleRight={() => setShowRight((s) => !s)}
                onNewIncident={() => setModal("new-incident")}
                onRandomIncident={() => postRandomIncident(API_BASE)}
                onNewVehicle={() => setModal("new-vehicle")}
            />

            <aside className="panel panel-left">
                <div className="panel-header">Kaynak Ağacı</div>
                <div className="panel-body">
                    <ResourceTree
                        apiBase={API_BASE}
                        vehicles={vehicles}
                        selectedVehicleId={selectedVehicleId}
                        onVehicleFocus={handleTreeFocus}
                        refreshKey={structureKey}
                    />
                </div>
            </aside>

            <div className="map-area">
                <Map
                    ref={mapRef}
                    incidents={displayIncidents}
                    vehicles={displayVehicles}
                    assignments={assignmentLines}
                    visibility={visibility}
                    selectedIncidentId={selectedIncident?.id ?? null}
                    selectedVehicleId={selectedVehicleId}
                    onVehicleMoved={handleVehicleMoved}
                    onIncidentClick={handleIncidentClick}
                    onVehicleClick={handleVehicleClick}
                />
                <MapOverlay
                    visibility={visibility}
                    onToggle={toggleLayer}
                    onFit={() => mapRef.current?.fitAll()}
                />
                {isReplay && (
                    <div className="replay-chip">
                        ◀ Geriye sarım · {new Date(pinnedAt!).toISOString().slice(11, 19)}
                    </div>
                )}
                <div className="map-stats">
                    <span className="stat-pill"><b>{openCount}</b> açık ihbar</span>
                    <span className="stat-pill"><b>{availableCount}</b> müsait araç</span>
                    <span className="stat-pill"><b>{activeAssignments.length}</b> görevde</span>
                </div>
            </div>

            <aside className="panel panel-right">
                <div className="panel-header">
                    <div className="tabs">
                        <button className={`tab ${rightTab === "events" ? "active" : ""}`}
                            onClick={() => setRightTab("events")}>Olaylar</button>
                        <button className={`tab ${rightTab === "recs" ? "active" : ""}`}
                            onClick={() => setRightTab("recs")}>Öneriler</button>
                        <button className={`tab ${rightTab === "assigns" ? "active" : ""}`}
                            onClick={() => setRightTab("assigns")}>
                            Atamalar <span className="count">{activeAssignments.length}</span>
                        </button>
                        <button className={`tab ${rightTab === "graph" ? "active" : ""}`}
                            onClick={() => setRightTab("graph")}>Graf</button>
                    </div>
                    {rightTab === "events" && events.length > 0 && (
                        <button className="assign-btn panel-header-action"
                            onClick={handleClearEvents} title="Yerel görüntüyü temizle">
                            Temizle
                        </button>
                    )}
                </div>
                <div className="panel-body">
                    {rightTab === "events" && (
                        <EventFeed events={displayedEvents} ctx={eventCtx} onFocus={handleEventFocus} />
                    )}
                    {rightTab === "recs" && (
                        <RecommendationsPanel
                            incident={selectedIncident}
                            incidentStatus={selectedIncidentStatus}
                            recommendations={recommendations}
                            loading={recsLoading}
                            onAssign={handleAssign}
                            onIncidentStatus={handleIncidentStatus}
                            onFocusIncident={focusIncident}
                        />
                    )}
                    {rightTab === "assigns" && (
                        <AssignmentsPanel
                            assignments={activeAssignments}
                            onCancel={handleCancelAssignment}
                            onResolve={handleResolveAssignment}
                            onFocus={focusVehicle}
                        />
                    )}
                    {rightTab === "graph" && (
                        <GraphPanel apiBase={API_BASE} refreshKey={graphKey} />
                    )}
                </div>
            </aside>

            <Timeline events={events} pinnedAt={pinnedAt} onScrub={setPinnedAt} />

            {modal === "new-incident" && (
                <NewIncidentModal apiBase={API_BASE} defaultCenter={mapCenter}
                    onClose={() => setModal(null)} onCreated={() => setGraphKey((n) => n + 1)} />
            )}
            {modal === "new-vehicle" && (
                <NewVehicleModal apiBase={API_BASE} defaultCenter={mapCenter}
                    onClose={() => setModal(null)} onCreated={() => setStructureKey((n) => n + 1)} />
            )}

            <Toaster />
        </div>
    );
}

export default App;
