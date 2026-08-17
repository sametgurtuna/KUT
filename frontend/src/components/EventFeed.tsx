export interface FeedEvent {
    id: number;
    eventType: string;
    entityType: string;
    entityId: number;
    timestamp: string;
    payload: string;
}

export interface EventContext {
    vehicleNames: Record<number, string>;
    incidentNames: Record<number, string>;
    /** assignment id → { vehicleId, incidentId } */
    assignmentRefs: Record<number, { vehicleId: number; incidentId: number }>;
}

interface Props {
    events: FeedEvent[];
    ctx: EventContext;
    onFocus: (e: FeedEvent) => void;
}

const TITLE: Record<string, string> = {
    VEHICLE_MOVED: "Araç hareket etti",
    VEHICLE_CREATED: "Araç eklendi",
    INCIDENT_CREATED: "Yeni ihbar",
    INCIDENT_STATUS_CHANGED: "İhbar durumu değişti",
    INCIDENT_RESOLVED: "İhbar çözüldü",
    VEHICLE_ASSIGNED: "Araç atandı",
    VEHICLE_RELEASED: "Atama iptal edildi",
};

function parse(payload: string): Record<string, unknown> {
    try { return JSON.parse(payload) as Record<string, unknown>; } catch { return {}; }
}

/** Human-readable second line, resolving ids to names where possible. */
function detail(e: FeedEvent, ctx: EventContext): string {
    const p = parse(e.payload);
    const vName = (id: unknown) =>
        typeof id === "number" ? (ctx.vehicleNames[id] ?? `Araç #${id}`) : "—";
    const iName = (id: unknown) =>
        typeof id === "number" ? (ctx.incidentNames[id] ?? `İhbar #${id}`) : "—";

    switch (e.eventType) {
        case "VEHICLE_MOVED": {
            const src = p.source === "sim" ? "rota üzerinde" : "elle taşındı";
            const lat = typeof p.latitude === "number" ? p.latitude.toFixed(4) : "?";
            const lng = typeof p.longitude === "number" ? p.longitude.toFixed(4) : "?";
            return `${ctx.vehicleNames[e.entityId] ?? `Araç #${e.entityId}`} · ${src} · ${lat}, ${lng}`;
        }
        case "VEHICLE_CREATED":
            return `${String(p.name ?? "")} · ${String(p.type ?? "")}`;
        case "INCIDENT_CREATED":
            return `${String(p.type ?? "")} · Şiddet ${String(p.severity ?? "?")}`;
        case "INCIDENT_STATUS_CHANGED":
            return `${iName(e.entityId)} → ${String(p.status ?? "")}`;
        case "VEHICLE_ASSIGNED":
            return `${vName(p.vehicleId)} → ${iName(p.incidentId)}`;
        case "VEHICLE_RELEASED":
            return `${vName(p.vehicleId)} serbest · ${iName(p.incidentId)}`;
        case "INCIDENT_RESOLVED":
            return `${vName(p.vehicleId)} · ${iName(p.incidentId)}${p.source === "sim" ? " · varış" : ""}`;
        default:
            return `${e.entityType} #${e.entityId}`;
    }
}

function EventFeed({ events, ctx, onFocus }: Props) {
    if (events.length === 0) {
        return (
            <div className="empty">
                <span className="empty-icon">📋</span>
                Henüz olay yok.
                <br />
                Bir araç sürükleyin ya da ihbar ekleyin.
            </div>
        );
    }

    return (
        <div>
            {events.map((e) => (
                <div key={e.id} className="event-row" onClick={() => onFocus(e)}>
                    <span className={`event-chip ${e.eventType.toLowerCase().replaceAll("_", "-")}`} />
                    <div className="event-meta">
                        <div className="event-title">
                            <span className="event-name">{TITLE[e.eventType] ?? e.eventType}</span>
                            <span className="event-time">
                                {new Date(e.timestamp).toISOString().slice(11, 19)}
                            </span>
                        </div>
                        <div className="event-detail">{detail(e, ctx)}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default EventFeed;
