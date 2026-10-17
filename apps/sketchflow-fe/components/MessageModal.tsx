type MessageModalProps = {
  title?: string;
  message: string;
  onClose: () => void;
  onAction?: () => void;
  buttonText?: string;
  dismissible?: boolean;
  buttonVariant?: "blue" | "purple";
};

export default function MessageModal({
  title = "Info 💡",
  message,
  onClose,
  onAction,
  buttonText = "Got It",
  dismissible = true,
  buttonVariant = "blue",
}: MessageModalProps) {
  const buttonColors =
    buttonVariant === "purple"
      ? "bg-violet-500 hover:bg-violet-600"
      : "bg-blue-500 hover:bg-blue-600";

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-sm ${
          dismissible ? "cursor-pointer" : ""
        }`}
        onClick={dismissible ? onClose : undefined}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-modal-title"
        className="relative z-61 w-full max-w-[320px] rounded-2xl
                   border border-border bg-card p-5 shadow-2xl"
      >
        <h3
          id="message-modal-title"
          className="text-base text-center font-semibold text-white"
        >
          {title}
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-white/85">
          {message}
        </p>

        <button
          onClick={onAction ?? onClose}
          className={`mt-4 w-full cursor-pointer rounded-lg px-4 py-2
                      text-sm font-medium text-white transition-colors
                      focus-visible:outline-none focus-visible:ring-2
                      focus-visible:ring-white/70 ${buttonColors}`}>
          {buttonText}
        </button>
      </div>
    </div>
  );
}