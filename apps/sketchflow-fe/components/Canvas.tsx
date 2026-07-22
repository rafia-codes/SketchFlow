import { useCallback, useEffect, useRef, useState } from "react";
import {
  Hand,
  Circle,
  Diamond,
  Pencil,
  Minus,
  RectangleHorizontalIcon,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  LockKeyholeOpen,
  LockKeyhole,
  ArrowRight,
  MousePointer,
} from "lucide-react";
import { Game } from "@/draw/Game";
import { useRouter } from "next/navigation";

export type Tool = "rect" | "ellipse" | "diamond" | "pencil" | "line" | "hand" | "lock" | "arrow" | "select"; //panning

const STROKE_COLORS = ["#1f2937", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];
const BG_COLORS = ["#fee2e2", "#fef3c7", "#dcfce7", "#dbeafe", "#ede9fe", "#fce7f3"];
const FILL_STYLES = ["hachure", "cross-hatch", "solid"] as const;
const STROKE_WIDTHS = [1, 2, 4] as const;
const STROKE_STYLES = ["solid", "dashed", "dotted"] as const;

export function Canvas({
  roomId,
  socket,
}: {
  roomId: string;
  socket: WebSocket;
}) {
  const canvasref = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game>();
  const [selectedTool, setSelectedTool] = useState<Tool>("select");
  const [scale, setScale] = useState<number>(1);
  const router = useRouter();
  const [isLocked, setIsLocked] = useState(false);

  const [fillColor, setFillColor] = useState("transparent");
  const [fillStyle, setFillStyle] = useState<
    "solid" | "cross-hatch" | "hachure"
  >("solid");

  const [strokeColor, setStrokeColor] = useState("#ffffff");
  const [strokeStyle, setStrokeStyle] = useState<"solid" | "dashed" | "dotted">(
    "solid",
  );
  const [strokeWidth, setStrokeWidth] = useState(2);

  const [opacity, setOpacity] = useState(1);

  const primaryTools = [
    "rect",
    "ellipse",
    "diamond",
    "pencil",
    "arrow",
    "line",
  ];

  useEffect(() => {
    game?.setSelectedTool(selectedTool);
    game?.setScale(scale);
    game?.setIsLocked(isLocked);
    game?.setFillColor(fillColor);
    game?.setFillStyle(fillStyle);
    game?.setStrokeColor(strokeColor);
    game?.setStrokeStyle(strokeStyle);
    game?.setStrokeWidth(strokeWidth);
    game?.setOpacity(opacity);
  }, [
    selectedTool,
    game,
    scale,
    isLocked,
    fillColor,
    fillStyle,
    strokeColor,
    strokeStyle,
    strokeWidth,
    opacity,
  ]);

  useEffect(() => {
    if (canvasref.current) {
      const g = new Game(canvasref.current, roomId, socket);
      setGame(g);
      return () => g.destroy();
    }
  }, [roomId, socket]);

  useEffect(() => {
    const handleresize = () => {
      if (!canvasref.current) return;
      canvasref.current.width = window.innerWidth;
      canvasref.current.height = window.innerHeight;
    };
    handleresize();
    window.addEventListener("resize", handleresize);
    return () => window.removeEventListener("resize", handleresize);
  }, []);

  const onZoomIn = () => {
    if (scale >= 1.5) return;
    setScale((prev) => Number((prev + 0.1).toFixed(1)));
  };

  const onZoomOut = () => {
    if (scale <= 0.5) return;
    setScale((prev) => Number((prev - 0.1).toFixed(1)));
  };

  const onUndo = () => {
    game?.undo();
  };

  const onRedo = () => {
    game?.redo();
  };

  const onShare = async () => {
    const url = window.location.href;
    const link = url.split("/canvas/").join("/");
    console.log(link);
    const shareData = {
      title: "Join my drawing canvas",
      text: `Share your ideas,thoughts and imagination by being creative here.`,
      url: link,
    };
    try {
      await navigator.share(shareData);
      console.log("Shared successfully");
    } catch (error) {
      console.log(error);
      await navigator.clipboard.writeText(link);
      alert("Link copied!");
    }
  };

  const onLeave = () => {
    socket.send(
      JSON.stringify({
        type: "leave_room",
        roomId,
      }),
    );
    socket.close(); //imp
    if (roomId.startsWith("guest")) router.push("/");
    else router.push("/dashboard");
  };

  return (
    <div
      style={{
        height: "100vh",
        background: "transparent",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasref}
        width={window.innerWidth}
        height={window.innerHeight}
      ></canvas>
      <Topbar
        setSelectedTool={setSelectedTool}
        selectedTool={selectedTool}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onRedo={onRedo}
        onUndo={onUndo}
        isLocked={isLocked}
        setIsLocked={setIsLocked}
      />
      
       {primaryTools.includes(selectedTool) && 
       <aside className="absolute top-1/2 left-5 -translate-y-1/2 w-60 rounded-2xl border border-border bg-card/95 backdrop-blur p-4 shadow-xl shadow-foreground/5 space-y-4 max-h-[80vh] overflow-y-auto">
          <SwatchRow
            label="Stroke"
            colors={STROKE_COLORS}
            value={strokeColor}
            onChange={setStrokeColor}
          />
          <SwatchRow
            label="Background"
            colors={BG_COLORS}
            value={fillColor}
            onChange={setFillColor}
            allowTransparent
          />
          {/* <SegRow
            label="Fill"
            options={FILL_STYLES as unknown as readonly string[]}
            value={fillStyle}
            onChange={(v) => setFillStyle(v as typeof fillStyle)}
          /> */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Stroke width</p>
            <div className="flex gap-1 p-1 rounded-lg bg-muted">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => setStrokeWidth(w)}
                  aria-label={`${w}px`}
                  className={`flex-1 h-9 rounded-md flex items-center justify-center transition-colors ${
                    strokeWidth === w
                      ? "bg-card ring-1 ring-primary/40"
                      : "hover:bg-card/60"
                  }`}
                >
                  <span
                    className="w-8 rounded-full bg-foreground"
                    style={{ height: w }}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Stroke style</p>
            <div className="flex gap-1 p-1 rounded-lg bg-muted">
              {STROKE_STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStrokeStyle(s)}
                  aria-label={s}
                  className={`flex-1 h-9 rounded-md flex items-center justify-center transition-colors ${
                    strokeStyle === s
                      ? "bg-card ring-1 ring-primary/40"
                      : "hover:bg-card/60"
                  }`}
                >
                  <svg width="32" height="8" viewBox="0 0 32 8">
                    <line
                      x1="2"
                      y1="4"
                      x2="30"
                      y2="4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={s === "dashed" ? "6 4" : s === "dotted" ? "1 4" : undefined}
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Opacity</p>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity*100}
              onChange={(e) => setOpacity(Number(e.target.value)/100)}
              className="w-full accent-primary"
            />
            <p className="text-right text-xs text-muted-foreground">{Math.round(opacity*100)}%</p>
          </div>
        </aside>
       }

      <div className="absolute top-6 right-4 flex gap-3">
        <button
          onClick={onShare}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium 
              bg-blue-500 text-white 
              hover:bg-blue-600 
              shadow-md hover:shadow-lg 
              transition-all duration-300 hover:-translate-y-0.5 
              cursor-pointer outline-none"
        >
          Share
        </button>

        <button
          onClick={onLeave}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium 
              bg-red-500 text-white 
              hover:bg-red-600 
              shadow-md hover:shadow-lg 
              transition-all duration-300 hover:-translate-y-0.5 
              cursor-pointer outline-none"
        >
          Leave
        </button>
      </div>
    </div>
  );
}

function Topbar({
  selectedTool,
  setSelectedTool,
  onZoomIn,
  onZoomOut,
  onUndo,
  onRedo,
  isLocked,
  setIsLocked,
}: {
  selectedTool: Tool;
  setSelectedTool: (s: Tool) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  isLocked: boolean;
  setIsLocked: (s: boolean) => void;
}) {
  return (
    <div
      style={{
        cursor: "pointer",
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        padding: "8px 14px",
        borderRadius: "14px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <ToolButton
        active={isLocked}
        onClick={() => (isLocked ? setIsLocked(false) : setIsLocked(true))}
        icon={
          isLocked ? <LockKeyhole size={18} /> : <LockKeyholeOpen size={18} />
        }
      />

      <Divider />

      <ToolButton
        active={selectedTool === "select"}
        onClick={() => setSelectedTool("select")}
        icon={<MousePointer size={18} />}
      />

      <ToolButton
        active={selectedTool === "hand"}
        onClick={() => setSelectedTool("hand")}
        icon={<Hand size={18} />}
      />
      <ToolButton
        active={selectedTool === "pencil"}
        onClick={() => setSelectedTool("pencil")}
        icon={<Pencil size={18} />}
      />
      <ToolButton
        active={selectedTool === "arrow"}
        onClick={() => setSelectedTool("arrow")}
        icon={<ArrowRight size={18} />}
      />
      <ToolButton
        active={selectedTool === "line"}
        onClick={() => setSelectedTool("line")}
        icon={<Minus size={18} />}
      />
      <ToolButton
        active={selectedTool === "rect"}
        onClick={() => setSelectedTool("rect")}
        icon={<RectangleHorizontalIcon size={18} />}
      />
      <ToolButton
        active={selectedTool === "ellipse"}
        onClick={() => setSelectedTool("ellipse")}
        icon={<Circle size={18} />}
      />
      <ToolButton
        active={selectedTool === "diamond"}
        onClick={() => setSelectedTool("diamond")}
        icon={<Diamond size={18} />}
      />

      <Divider />

      <ToolButton onClick={onZoomOut} icon={<ZoomOut size={18} />} />
      <ToolButton onClick={onZoomIn} icon={<ZoomIn size={18} />} />

      <Divider />

      <ToolButton onClick={onUndo} icon={<Undo2 size={18} />} />
      <ToolButton onClick={onRedo} icon={<Redo2 size={18} />} />
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  icon,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: "10px",
        border: "none",
        cursor: "pointer",
        background: active ? "#111" : "transparent",
        color: active ? "#fff" : "#333",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "#eee";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: "1px",
        height: "24px",
        background: "#000",
        margin: "0 6px",
      }}
    />
  );
}

function SwatchRow({
  label,
  colors,
  value,
  onChange,
  allowTransparent = false,
}: {
  label: string;
  colors: readonly string[];
  value: string;
  onChange: (c: string) => void;
  allowTransparent?: boolean;
}) {
  const isCustom = !colors.includes(value) && value !== "transparent";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <ColorPreview color={value} />
      </div>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            aria-label={c}
            title={c}
            className={`w-7 h-7 rounded-md border transition-colors ${
              value === c
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:border-primary/60"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}

        <label
          className={`w-7 h-7 rounded-md border flex items-center justify-center cursor-pointer transition-colors ${
            isCustom
              ? "border-primary ring-1 ring-primary"
              : "border-border hover:border-primary/60"
          }`}
          title="Custom color"
        >
          <span className="text-xs text-muted-foreground">+</span>
          <input
            type="color"
            value={value === "transparent" ? "#ffffff" : value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
            aria-label="Choose custom color"
          />
        </label>

        {allowTransparent && (
          <button
            onClick={() => onChange("transparent")}
            aria-label="No fill"
            title="No fill"
            className={`w-7 h-7 rounded-md border transition-colors ${
              value === "transparent"
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:border-primary/60"
            }`}
            style={{
              background:
                "repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 8px 8px",
            }}
          />
        )}
      </div>
    </div>
  );
}

function ColorPreview({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono uppercase">
      <span
        className="w-3 h-3 rounded border border-border"
        style={{
          background:
            color === "transparent"
              ? "repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 6px 6px"
              : color,
        }}
      />
      {color === "transparent" ? "none" : color}
    </div>
  );
}

function SegRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div className="flex gap-1 p-1 rounded-lg bg-muted">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            title={o}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
              value === o
                ? "bg-card text-foreground ring-1 ring-primary/40"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}