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
  LockKeyhole
} from "lucide-react";
import { Game } from "@/draw/Game";
import { useRouter } from "next/navigation";

export type Tool = "rect" | "ellipse" | "diamond" | "pencil" | "line" | "hand" | "lock"; //panning

export function Canvas({
  roomId,
  socket,
}: {
  roomId: string;
  socket: WebSocket;
}) {
  const canvasref = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game>();
  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
  const [scale, setScale] = useState<number>(1);
  const router = useRouter();
  const [isLocked,setIsLocked] = useState(false);

  useEffect(() => {
    game?.setSelectedTool(selectedTool);
    game?.setScale(scale);
    game?.setIsLocked(isLocked);
  }, [selectedTool, game, scale, isLocked]);

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
    socket.send(JSON.stringify({
      type:"leave_room",
      roomId
    }));
    socket.close();//imp
    if(roomId.startsWith('guest'))
      router.push('/');
    else
      router.push("/dashboard");
  }

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
      <div className="absolute top-6 right-4 flex gap-3">
        <button
          onClick={onShare}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium 
              bg-blue-500 text-white 
              hover:bg-blue-600 
              shadow-md hover:shadow-lg 
              transition-all duration-300 hover:-translate-y-0.5 
              cursor-pointer outline-none">
          Share
        </button>

        <button
          onClick={onLeave}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium 
              bg-red-500 text-white 
              hover:bg-red-600 
              shadow-md hover:shadow-lg 
              transition-all duration-300 hover:-translate-y-0.5 
              cursor-pointer outline-none">
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
  setIsLocked
}: {
  selectedTool: Tool;
  setSelectedTool: (s: Tool) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  isLocked: boolean;
  setIsLocked: (s: boolean) => void
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
        onClick={() => isLocked?setIsLocked(false):setIsLocked(true)}
        icon={isLocked?<LockKeyhole size={18} />:<LockKeyholeOpen size={18}/>}
      />

      <Divider/>

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
