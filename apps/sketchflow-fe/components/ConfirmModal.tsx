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
    if (!open) {
      setTyped("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const needsTyping = !!confirmWord;

  const canConfirm =
    !needsTyping || typed.trim() === confirmWord;

  const confirmClasses =
    tone === "danger"
      ? `
        bg-orange-500/90
        text-white
        border border-orange-400/50
        hover:bg-orange-500
        shadow-lg shadow-orange-500/25
        hover:shadow-xl hover:shadow-orange-500/30
      `
      : `
        bg-orange-500/90
        text-white
        border border-orange-400/50
        hover:bg-orange-500
        shadow-lg shadow-orange-500/25
        hover:shadow-xl hover:shadow-orange-500/30
      `;

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-center justify-center
      "
      role="dialog"
      aria-modal="true"
    >
   
      <div
        className="
          absolute inset-0
          bg-black/45
          backdrop-blur-md
        "
        onClick={onCancel}
      />

      <div
        className="
          relative z-10
          w-full max-w-md mx-4
          rounded-2xl

          border border-white/25

          bg-white/65
          backdrop-blur-2xl
          backdrop-saturate-150

          p-8

          shadow-2xl
          shadow-black/25

          ring-1 ring-white/10

          animate-in
          fade-in
          zoom-in-95
          duration-200
        "
        onClick={(e) => e.stopPropagation()}
      >
        
        <div
          className="
            pointer-events-none
            absolute inset-x-0 top-0
            h-px
            bg-linear-to-r
            from-transparent
            via-white/80
            to-transparent
          "
        />

        
        <button
          onClick={onCancel}
          aria-label="Close modal"
          className="
            absolute top-4 right-4

            w-8 h-8
            flex items-center justify-center

            rounded-lg

            text-gray-500

            hover:text-gray-800
            hover:bg-white/50

            transition-all duration-200

            cursor-pointer
          "
        >
          ✕
        </button>

        
        <h2
          className="
            text-2xl
            font-bold
            tracking-tight
            text-gray-800
            pr-8
          "
        >
          {title}
        </h2>

        
        {description && (
          <p
            className="
              mt-2
              text-sm
              leading-6
              text-gray-600
              max-w-sm
            "
          >
            {description}
          </p>
        )}

       
        {needsTyping && (
          <div className="mt-6 space-y-2">
            <label
              htmlFor="confirm-input"
              className="
                block
                text-sm
                font-medium
                text-gray-700
              "
            >
              Type{" "}
              <span
                className="
                  font-mono
                  font-semibold
                  text-orange-600
                "
              >
                {confirmWord}
              </span>{" "}
              to continue
            </label>

            <input
              id="confirm-input"
              type="text"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              className="
                flex h-11 w-full

                rounded-xl

                border border-white/50

                bg-white/55
                backdrop-blur-md

                px-3

                text-sm
                text-gray-800

                placeholder:text-gray-400

                shadow-inner
                shadow-black/5

                outline-none

                transition-all duration-200

                focus:border-orange-400/60
                focus:bg-white/75
                focus:ring-2
                focus:ring-orange-500/20
              "
            />
          </div>
        )}

        <div
          className="
            mt-7
            flex
            gap-3
            justify-end
          "
        >
          
          <button
            onClick={onCancel}
            className="
              px-5 py-2.5

              rounded-xl

              text-sm
              font-medium

              border border-gray-300/70

              bg-white/45
              backdrop-blur-md

              text-gray-700

              hover:bg-white/70
              hover:border-orange-300
              hover:text-orange-600

              transition-all duration-200

              cursor-pointer
            "
          >
            {cancelLabel}
          </button>

         
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`
              px-5 py-2.5

              rounded-xl

              text-sm
              font-medium

              transition-all duration-200

              hover:-translate-y-0.5

              disabled:opacity-35
              disabled:pointer-events-none

              cursor-pointer

              ${confirmClasses}
            `}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}