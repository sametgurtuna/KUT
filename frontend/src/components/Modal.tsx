import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface Props {
    title: string;
    onClose: () => void;
    children: ReactNode;
}

function Modal({ title, onClose, children }: Props) {
    // Only close when the press *starts and ends* on the backdrop, so dragging
    // a slider inside the dialog and releasing outside doesn't dismiss it.
    const pressedBackdrop = useRef(false);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            className="modal-backdrop"
            onMouseDown={(e) => { pressedBackdrop.current = e.target === e.currentTarget; }}
            onMouseUp={(e) => {
                if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
                pressedBackdrop.current = false;
            }}
        >
            <div className="modal">
                <div className="modal-header">
                    <span>{title}</span>
                    <button className="modal-close" onClick={onClose} aria-label="Kapat">×</button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
}

export default Modal;
