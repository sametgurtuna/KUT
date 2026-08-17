import { useEffect, useState } from "react";

export interface Recommendation {
    vehicleId: number;
    vehicleName: string;
    vehicleType: string;
    teamName: string | null;
    distanceKm: number;
    durationMin: number | null;
    distanceSource: string;
    compatibilityScore: number;
}

export interface SelectedIncident {
    id: number;
    type: string;
    severity: number;
}

interface Props {
    incident: SelectedIncident | null;
    incidentStatus: string | null;
    recommendations: Recommendation[];
    loading: boolean;
    onAssign: (incidentId: number, vehicleIds: number[]) => void;
    onIncidentStatus: (incidentId: number, status: "InProgress" | "Resolved") => void;
    onFocusIncident: (incidentId: number) => void;
}

const COMPAT = ["Uyumsuz", "Kısmen", "Tam uyum"];

function RecommendationsPanel({
    incident, incidentStatus, recommendations, loading,
    onAssign, onIncidentStatus, onFocusIncident,
}: Props) {
    const [multi, setMulti] = useState(false);
    const [picked, setPicked] = useState<Set<number>>(new Set());

    useEffect(() => {
        setPicked(new Set());
        setMulti(false);
    }, [incident?.id]);

    if (!incident) {
        return (
            <div className="empty">
                <span className="empty-icon">🎯</span>
                Haritadan bir ihbar seçin.
                <br />
                En yakın uygun araçlar burada listelenir.
            </div>
        );
    }

    const toggle = (id: number) => setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const statusKey = (incidentStatus ?? "").toLowerCase();
    const resolved = incidentStatus === "Resolved";

    return (
        <div>
            <div className="rec-header">
                <h3>
                    <span
                        style={{ cursor: "pointer" }}
                        onClick={() => onFocusIncident(incident.id)}
                        title="Haritada göster"
                    >
                        {incident.type}
                    </span>
                    {incidentStatus && (
                        <span className={`badge badge-status ${statusKey}`}>{incidentStatus}</span>
                    )}
                </h3>
                <div className="rec-sub">
                    #{incident.id} · Şiddet {incident.severity} · {recommendations.length} uygun araç
                </div>
                {!resolved && (
                    <div className="rec-actions">
                        <button className="assign-btn" onClick={() => setMulti((m) => !m)}>
                            {multi ? "✓ Çoklu seçim" : "Çoklu seçim"}
                        </button>
                        {incidentStatus !== "InProgress" && (
                            <button className="assign-btn"
                                onClick={() => onIncidentStatus(incident.id, "InProgress")}>
                                Başlat
                            </button>
                        )}
                        <button className="assign-btn"
                            onClick={() => onIncidentStatus(incident.id, "Resolved")}>
                            Çöz
                        </button>
                    </div>
                )}
            </div>

            {multi && !resolved && (
                <div className="multi-bar">
                    <span>{picked.size} araç seçili</span>
                    <button
                        className="assign-btn primary"
                        disabled={picked.size === 0}
                        onClick={() => { onAssign(incident.id, Array.from(picked)); setPicked(new Set()); }}
                    >
                        Seçilenleri ata
                    </button>
                </div>
            )}

            {loading && <div className="empty">Hesaplanıyor…</div>}

            {!loading && recommendations.length === 0 && (
                <div className="empty">
                    <span className="empty-icon">🚫</span>
                    Müsait araç yok.
                    <br />
                    Bir atamayı kaldırınca burada görünür.
                </div>
            )}

            {!loading && recommendations.map((r) => (
                <div key={r.vehicleId} className="rec-row">
                    {multi && !resolved && (
                        <input type="checkbox" className="rec-check"
                            checked={picked.has(r.vehicleId)}
                            onChange={() => toggle(r.vehicleId)} />
                    )}
                    <div className="rec-info">
                        <div className="rec-name">
                            <span className={`badge compat-${r.compatibilityScore}`}>
                                {COMPAT[r.compatibilityScore] ?? "?"}
                            </span>
                            {r.vehicleName}
                        </div>
                        <div className="rec-meta">
                            {r.vehicleType} · {r.teamName ?? "ekipsiz"}
                            {r.distanceSource === "haversine" && " · kuş uçuşu"}
                        </div>
                    </div>
                    <div className="rec-numbers">
                        <div className="rec-distance">{r.distanceKm} km</div>
                        {r.durationMin != null && (
                            <div className="rec-meta">~{r.durationMin} dk</div>
                        )}
                    </div>
                    {!multi && !resolved && (
                        <button className="assign-btn primary"
                            onClick={() => onAssign(incident.id, [r.vehicleId])}>
                            Ata
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

export default RecommendationsPanel;
