import { useEffect, useState } from "react";
import Modal from "./Modal";

interface Team {
    id: number;
    name: string;
    organizationId: number;
}

interface Props {
    apiBase: string;
    defaultCenter: [number, number]; // [lng, lat]
    onClose: () => void;
    onCreated: () => void;
}

const TYPES = ["Yangın", "Merdivenli", "Arama-Kurtarma", "Kurtarma", "Ambulans"];
const CAPS = ["yangin", "merdivenli", "arama-kurtarma", "kurtarma"];

function NewVehicleModal({ apiBase, defaultCenter, onClose, onCreated }: Props) {
    const [teams, setTeams] = useState<Team[]>([]);
    const [name, setName] = useState("");
    const [type, setType] = useState(TYPES[0]);
    const [teamId, setTeamId] = useState<number | "">("");
    const [caps, setCaps] = useState<string[]>(["yangin"]);
    const [lng, setLng] = useState(() => defaultCenter[0] + (Math.random() - 0.5) * 0.06);
    const [lat, setLat] = useState(() => defaultCenter[1] + (Math.random() - 0.5) * 0.04);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${apiBase}/api/teams`).then((r) => r.json()).then((ts: Team[]) => {
            setTeams(ts);
            if (ts.length > 0) setTeamId(ts[0].id);
        }).catch(() => setError("Ekipler yüklenemedi."));
    }, [apiBase]);

    const submit = () => {
        if (teamId === "") return;
        setBusy(true);
        setError(null);
        fetch(`${apiBase}/api/vehicles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name, type, capabilities: caps.join(","),
                teamId, latitude: lat, longitude: lng,
            }),
        }).then((r) => {
            setBusy(false);
            if (r.ok) { onCreated(); onClose(); }
            else setError("Araç oluşturulamadı.");
        }).catch(() => { setBusy(false); setError("Sunucuya ulaşılamadı."); });
    };

    return (
        <Modal title="Yeni araç" onClose={onClose}>
            <div className="form-row">
                <label>İsim</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="boş bırakılırsa otomatik atanır" autoFocus />
            </div>

            <div className="form-grid">
                <div className="form-row">
                    <label>Tip</label>
                    <select value={type} onChange={(e) => setType(e.target.value)}>
                        {TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                </div>
                <div className="form-row">
                    <label>Ekip</label>
                    <select value={teamId} onChange={(e) => setTeamId(Number(e.target.value))}>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="form-row">
                <label>Yetenekler</label>
                <div className="chip-group">
                    {CAPS.map((c) => (
                        <span key={c}
                            className={`chip ${caps.includes(c) ? "on" : ""}`}
                            onClick={() => setCaps((prev) =>
                                prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])}
                        >{c}</span>
                    ))}
                </div>
            </div>
            <div className="form-hint">
                Yetenekler öneri sıralamasını belirler — ihbar tipiyle eşleşen araç üste çıkar.
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
                <button onClick={onClose} disabled={busy}>İptal</button>
                <button className="assign-btn primary" onClick={submit}
                    disabled={busy || teamId === ""}>
                    {busy ? "Oluşturuluyor…" : "Oluştur"}
                </button>
            </div>
        </Modal>
    );
}

export default NewVehicleModal;
