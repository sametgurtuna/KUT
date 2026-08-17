// Tiny event-emitter toast bus — no context/provider gymnastics. Components
// call `toast(...)`; a single <Toaster /> mounted in App subscribes.

export type ToastKind = "info" | "success" | "warn" | "error";

export interface ToastItem {
    id: number;
    kind: ToastKind;
    message: string;
    createdAt: number;
}

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function notify() {
    for (const l of listeners) l(items);
}

export function toast(message: string, kind: ToastKind = "info", ttlMs = 3200) {
    const item: ToastItem = { id: nextId++, kind, message, createdAt: Date.now() };
    items = [...items, item];
    notify();
    setTimeout(() => {
        items = items.filter((x) => x.id !== item.id);
        notify();
    }, ttlMs);
}

export function subscribe(listener: Listener) {
    listeners.add(listener);
    listener(items);
    return () => {
        listeners.delete(listener);
    };
}
