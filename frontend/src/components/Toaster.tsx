import { useEffect, useState } from "react";
import { subscribe } from "../lib/toast";
import type { ToastItem } from "../lib/toast";

function Toaster() {
    const [items, setItems] = useState<ToastItem[]>([]);
    useEffect(() => subscribe(setItems), []);
    return (
        <div className="toast-stack">
            {items.map((t) => (
                <div key={t.id} className={`toast toast-${t.kind}`}>
                    {t.message}
                </div>
            ))}
        </div>
    );
}

export default Toaster;
