import { useEffect, useMemo, useState } from "react";
import type { FeedEvent } from "./EventFeed";

interface Props {
    events: FeedEvent[];
    pinnedAt: number | null; // ms; null = live
    onScrub: (ts: number | null) => void;
}

const WINDOW_MS = 30 * 60 * 1000; // show at most the last 30 minutes

/**
 * Scrubbable timeline. The upper bound only advances on a slow tick (not on
 * every render) so the slider handle doesn't jitter under the cursor.
 */
function Timeline({ events, pinnedAt, onScrub }: Props) {
    const [nowTick, setNowTick] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNowTick(Date.now()), 2000);
        return () => clearInterval(id);
    }, []);

    const bounds = useMemo(() => {
        const max = nowTick;
        if (events.length === 0) return { min: max - 5 * 60 * 1000, max };
        const oldest = Math.min(...events.map((e) => new Date(e.timestamp).getTime()));
        return { min: Math.max(oldest, max - WINDOW_MS), max };
    }, [events, nowTick]);

    const total = Math.max(1000, bounds.max - bounds.min);
    const value = pinnedAt ?? bounds.max;
    const pct = (t: number) => Math.max(0, Math.min(100, ((t - bounds.min) / total) * 100));

    const visibleTicks = useMemo(
        () => events.filter((e) => {
            const t = new Date(e.timestamp).getTime();
            return t >= bounds.min && t <= bounds.max;
        }),
        [events, bounds.min, bounds.max]
    );

    const fmt = (t: number) => new Date(t).toISOString().slice(11, 19);

    return (
        <div className="timeline">
            <div className="timeline-head">
                <span className="tl-title">Zaman Şeridi</span>
                {pinnedAt != null ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="tl-now">◀ geriye sarım {fmt(pinnedAt)}</span>
                        <button className="assign-btn primary" onClick={() => onScrub(null)}>
                            Canlıya dön
                        </button>
                    </span>
                ) : (
                    <span>{visibleTicks.length} olay · canlı</span>
                )}
            </div>
            <div className="timeline-track">
                <div className="timeline-ticks">
                    {visibleTicks.map((e) => (
                        <span
                            key={e.id}
                            className={`tick ${e.eventType.toLowerCase().replaceAll("_", "-")}`}
                            style={{ left: `${pct(new Date(e.timestamp).getTime())}%` }}
                            title={`${e.eventType} · ${fmt(new Date(e.timestamp).getTime())}`}
                        />
                    ))}
                </div>
                <input
                    type="range"
                    min={bounds.min}
                    max={bounds.max}
                    step={1000}
                    value={value}
                    onChange={(ev) => {
                        const t = Number(ev.target.value);
                        // Snapping to the far right means "live" again.
                        onScrub(t >= bounds.max - 1500 ? null : t);
                    }}
                />
            </div>
            <div className="timeline-labels">
                <span>{fmt(bounds.min)}</span>
                <span>{fmt(bounds.max)} UTC</span>
            </div>
        </div>
    );
}

export default Timeline;
