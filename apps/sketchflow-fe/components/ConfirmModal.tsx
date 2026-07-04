import { useEffect, useState } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmWord?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}
export default function ConfirmModal({
  open,
  title,
  description,
  confirmWord,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const needsTyping = !!confirmWord;
  const canConfirm = !needsTyping || typed.trim() === confirmWord;

  const confirmClasses =
    tone === "danger"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/25 hover:shadow-xl hover:shadow-destructive/30"
      : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-border bg-card p-8 shadow-2xl shadow-foreground/5 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          aria-label="Close modal"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          ✕
        </button>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}

        {needsTyping && (
          <div className="mt-6 space-y-2">
            <label htmlFor="confirm-input" className="block text-sm font-medium text-foreground">
              Type <span className="font-mono font-semibold text-foreground">{confirmWord}</span> to continue
            </label>
            <input
              id="confirm-input"
              type="text"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
            />
          </div>
        )}

        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border-2 border-border text-foreground hover:border-primary hover:text-primary transition-all duration-300"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}