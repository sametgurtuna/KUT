import { useState } from "react";
import Modal from "./Modal";
import { INCIDENT_TYPES, randomInIstanbul } from "../lib/randomIncident";

interface Props {
    apiBase: string;
    defaultCenter: [number, number]; // [lng, lat]
    onClose: () => void;
    onCreated: () => void;
}

function NewIncidentModal({ apiBase, defaultCenter, onClose, onCreated }: Props) {
    const [type, setType] = useState(INCIDENT_TYPES[0]);
    const [severity, setSeverity] = useState(3);
    const [lng, setLng] = useState(defaultCenter[0]);
    const [lat, setLat] = useState(defaultCenter[1]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const randomize = () => {
        const [rlng, rlat] = randomInIstanbul();
        setType(INCIDENT_TYPES[Math.floor(Math.random() * INCIDENT_TYPES.length)]);
        setSeverity(1 + Math.floor(Math.random() * 5));
        setLng(rlng);
        setLat(rlat);
    };

    const submit = () => {
        setBusy(true);
        setError(null);
        fetch(`${apiBase}/api/incidents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, severity, latitude: lat, longitude: lng }),
        }).then((r) => {
            setBusy(false);
            if (r.ok) { onCreated(); onClose(); }
            else setError("İhbar oluşturulamadı.");
        }).catch(() => { setBusy(false); setError("Sunucuya ulaşılamadı."); });
    };

    return (
        <Modal title="Yeni ihbar" onClose={onClose}>
            <div className="form-row">
                <label>Tip</label>
                <div className="chip-group">
                    {INCIDENT_TYPES.map((t) => (
                        <span key={t} className={`chip ${type === t ? "on" : ""}`}
                            onClick={() => setType(t)}>{t}</span>
                    ))}
                </div>
            </div>

            <div className="form-row">
                <label>Şiddet — {severity}</label>
                <input type="range" min={1} max={5} step={1} value={severity}
                    onChange={(e) => setSeverity(Number(e.target.value))}
                    style={{ accentColor: "var(--accent)", padding: 0, border: "none", background: "transparent" }} />
            </div>

            <div className="form-grid">
                <div className="form-row">
                    <label>Enlem</label>
                    <input type="number" step="0.0001" value={lat}
                        onChange={(e) => setLat(Number(e.target.value))} />
                </div>
                <div className="form-row">
                    <label>Boylam</label>
                    <input type="number" step="0.0001" value={lng}
                        onChange={(e) => setLng(Number(e.target.value))} />
                </div>
            </div>

            {error && <div className="form-hint" style={{ color: "var(--danger)" }}>{error}</div>}

            <div className="form-actions">
                <button onClick={randomize} disabled={busy}>🎲 Rastgele doldur</button>
                <button onClick={onClose} disabled={busy}>İptal</button>
                <button className="assign-btn primary" onClick={submit} disabled={busy}>
                    {busy ? "Oluşturuluyor…" : "Oluştur"}
                </button>
            </div>
        </Modal>
    );
}

export default NewIncidentModal;
