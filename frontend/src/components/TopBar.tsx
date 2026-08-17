import { useEffect, useState } from "react";

export type ConnState = "connecting" | "connected" | "reconnecting" | "disconnected";

interface Props {
    connState: ConnState;
    showLeft: boolean;
    showRight: boolean;
    onToggleLeft: () => void;
    onToggleRight: () => void;
    onNewIncident: () => void;
    onRandomIncident: () => void;
    onNewVehicle: () => void;
}

const LABEL: Record<ConnState, string> = {
    connecting: "bağlanıyor",
    connected: "canlı",
    reconnecting: "yeniden bağlanıyor",
    disconnected: "bağlantı yok",
};

function TopBar({
    connState, showLeft, showRight, onToggleLeft, onToggleRight,
    onNewIncident, onRandomIncident, onNewVehicle,
}: Props) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const dotClass =
        connState === "connected" ? "ok" :
        connState === "reconnecting" ? "warn" :
        connState === "disconnected" ? "err" : "";

    return (
        <header className="app-topbar">
            <span className="brand">KUT</span>
            <span className="brand-sub">Operasyon Merkezi</span>

            <span className="topbar-divider" />

            <div className="topbar-actions">
                <button className="topbar-btn" onClick={onToggleLeft}
                    title="Kaynak ağacını göster/gizle">
                    {showLeft ? "◧" : "▢"}
                </button>
                <button className="topbar-btn" onClick={onToggleRight}
                    title="Sağ paneli göster/gizle">
                    {showRight ? "◨" : "▢"}
                </button>
            </div>

            <span className="topbar-divider" />

            <div className="topbar-actions">
                <button className="topbar-btn primary" onClick={onRandomIncident}
                    title="Rastgele konumda bir ihbar oluştur">
                    🎲 Rastgele ihbar
                </button>
                <button className="topbar-btn" onClick={onNewIncident}>+ İhbar</button>
                <button className="topbar-btn" onClick={onNewVehicle}>+ Araç</button>
            </div>

            <span className="spacer" />

            <span className="conn">
                <span className={`conn-dot ${dotClass}`} />
                {LABEL[connState]}
            </span>
            <span className="app-clock">{now.toISOString().slice(11, 19)} UTC</span>
        </header>
    );
}

export default TopBar;
