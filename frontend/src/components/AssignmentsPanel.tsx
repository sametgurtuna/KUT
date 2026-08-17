import { formatMmSs } from "../lib/useNow";

export interface ActiveAssignment {
    id: number;
    incidentId: number;
    vehicleId: number;
    vehicleName: string;
    incidentType: string;
    incidentSeverity: number;
    createdAt: string;
    etaSeconds: number | null;
    /** 0–1 progress along the route, from the backend simulator. */
    progress: number;
}

interface Props {
    assignments: ActiveAssignment[];
    onCancel: (assignmentId: number) => void;
    onResolve: (assignmentId: number) => void;
    onFocus: (vehicleId: number) => void;
}

function AssignmentsPanel({ assignments, onCancel, onResolve, onFocus }: Props) {
    if (assignments.length === 0) {
        return (
            <div className="empty">
                <span className="empty-icon">🚒</span>
                Aktif atama yok.
                <br />
                Öneriler sekmesinden bir araç atayın.
            </div>
        );
    }

    return (
        <div>
            {assignments.map((a) => {
                // ETA is real driving time, but the simulator fast-forwards the
                // vehicle — so scale it by route progress rather than wall clock,
                // otherwise the countdown and the moving marker disagree.
                let eta: string | null = null;
                if (a.etaSeconds != null) {
                    const remaining = a.etaSeconds * (1 - Math.min(1, Math.max(0, a.progress)));
                    eta = remaining > 1 ? formatMmSs(remaining) : "varış";
                }
                return (
                    <div key={a.id} className="rec-row">
                        <div className="rec-info" style={{ cursor: "pointer" }}
                            onClick={() => onFocus(a.vehicleId)} title="Haritada göster">
                            <div className="rec-name">{a.vehicleName}</div>
                            <div className="rec-meta">
                                → {a.incidentType} · Sev {a.incidentSeverity}
                                {eta && ` · ETA ${eta}`}
                            </div>
                            <div style={{
                                height: 2, background: "var(--border)", borderRadius: 1,
                                marginTop: 5, overflow: "hidden",
                            }}>
                                <div style={{
                                    height: "100%",
                                    width: `${Math.round(a.progress * 100)}%`,
                                    background: "var(--accent)",
                                    transition: "width 400ms linear",
                                }} />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            <button className="assign-btn primary" onClick={() => onResolve(a.id)}
                                title="Vardı — atamayı tamamla">Vardı</button>
                            <button className="assign-btn" onClick={() => onCancel(a.id)}
                                title="Atamayı iptal et">İptal</button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default AssignmentsPanel;
