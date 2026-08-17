import { useEffect, useState } from "react";

/** Rerenders once per second — good enough for mm:ss countdowns. */
export function useNow(intervalMs = 1000): number {
    const [t, setT] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setT(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return t;
}

export function formatMmSs(secondsRemaining: number): string {
    const s = Math.max(0, Math.round(secondsRemaining));
    const mm = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
}
