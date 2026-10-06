type MessageModalProps = {
    title?: string,
    message: string;
    onClose: () => void,
    buttonText?: string,
}

export default function MessageModal({title = "Info 💡",message,onClose,buttonText = "Got It"}:MessageModalProps){
    return <>
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-[320px] rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-foreground text-white/90">
          {title}
        </h3>

        <p className="mt-2 text-sm text-muted-foreground text-white/90">
          {message}
        </p>

        <button
          onClick={onClose}
          className="cursor-pointer mt-4 w-full rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
        >
          {buttonText}
        </button>
      </div>
    </div>
    </>
}