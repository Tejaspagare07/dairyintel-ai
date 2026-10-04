import { useEffect } from "react";

export default function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className={`modal pop-in ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="tb-icon" onClick={onClose} aria-label="Close" style={{ width: 34, height: 34 }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
