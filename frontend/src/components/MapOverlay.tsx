import { useState } from "react";
import type { LayerVisibility } from "./Map";

interface Props {
    visibility: LayerVisibility;
    onToggle: (key: keyof LayerVisibility) => void;
    onFit: () => void;
}

const LAYERS: [keyof LayerVisibility, string][] = [
    ["incidents", "İhbarlar"],
    ["vehicles", "Araçlar"],
    ["routes", "Rotalar"],
    ["heat", "Isı haritası"],
];

function MapOverlay({ visibility, onToggle, onFit }: Props) {
    const [open, setOpen] = useState(true);

    return (
        <div className="map-overlay">
            <div className="overlay-card">
                <h4 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: open ? 6 : 0 }}>
                    <span>Katmanlar</span>
                    <span style={{ cursor: "pointer", fontSize: 11 }} onClick={() => setOpen((o) => !o)}>
                        {open ? "−" : "+"}
                    </span>
                </h4>
                {open && (
                    <>
                        {LAYERS.map(([key, label]) => (
                            <label key={key} className="toggle-row">
                                <input type="checkbox" checked={visibility[key]}
                                    onChange={() => onToggle(key)} />
                                {label}
                            </label>
                        ))}
                        <button className="assign-btn" style={{ marginTop: 7, width: "100%" }}
                            onClick={onFit}>
                            Tümüne odakla
                        </button>
                    </>
                )}
            </div>

            {open && (
                <div className="overlay-card">
                    <h4>Gösterge</h4>
                    <div className="legend-row">
                        <span className="legend-dot" style={{ background: "#f2555a" }} /> Şiddet 4–5
                    </div>
                    <div className="legend-row">
                        <span className="legend-dot" style={{ background: "#f97316" }} /> Şiddet 3
                    </div>
                    <div className="legend-row">
                        <span className="legend-dot" style={{ background: "#f5a524" }} /> Şiddet 1–2
                    </div>
                    <div className="legend-row">
                        <span className="legend-dot" style={{ background: "#5a6875", opacity: 0.5 }} /> Çözüldü
                    </div>
                    <div style={{ height: 5 }} />
                    <div className="legend-row">
                        <span className="legend-tri" style={{ borderBottom: "9px solid #2dd4e8" }} /> Müsait araç
                    </div>
                    <div className="legend-row">
                        <span className="legend-tri" style={{ borderBottom: "9px solid #f5a524" }} /> Görevde
                    </div>
                </div>
            )}
        </div>
    );
}

export default MapOverlay;
