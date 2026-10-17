import { useEffect, useRef, useState, useCallback } from "react";
import { Hand,Circle,Diamond,Pencil,Minus,MousePointer2,RectangleHorizontalIcon,ZoomIn,ZoomOut,Undo2,Redo2,LockKeyholeOpen,LockKeyhole,ArrowRight,MousePointer,CopyPlus,Trash2,Grid3X3,Grid2X2Check,MoveUp,MoveDown,BringToFront,SendToBack,Users,X,Type, AlignCenter, AlignLeft, AlignRight, Bold, Italic, Maximize, PaintRoller, MonitorPlay} from "lucide-react";
import { Game } from "@/draw/Game";
import { useRouter } from "next/navigation";
import { Toast,User,PresentationModalConfig } from "@/draw/types";
import MessageModal from "./MessageModal";
import ConfirmModal from "./ConfirmModal";

export type Tool = | "rect" | "ellipse" | "diamond" | "pencil" | "line" | "hand" | "lock" | "arrow" | "select" | "text" | "laser"; //panning

const STROKE_COLORS = ["#1f2937","#ef4444","#f59e0b","#10b981","#3b82f6","#8b5cf6",];
const BG_COLORS = ["#fee2e2","#fef3c7","#dcfce7","#dbeafe","#ede9fe","#fce7f3",];
const FILL_STYLES = ["hachure", "cross-hatch", "solid"] as const;
const STROKE_WIDTHS = [1, 2, 4] as const;
const STROKE_STYLES = ["solid", "dashed", "dotted"] as const;

export function Canvas({roomId,socket,}: { roomId: string; socket: WebSocket}) {
  const canvasref = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game>();
  const [shapeSelected, setShapeSelected] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool>("select");
  const [scale, setScale] = useState<number>(1);
  const router = useRouter();
  const [isLocked, setIsLocked] = useState(false);

  const [fillColor, setFillColor] = useState("transparent");
  const [fillStyle, setFillStyle] = useState<"solid" | "cross-hatch" | "hachure">("solid");

  const [strokeColor, setStrokeColor] = useState("#ffffff");
  const [strokeStyle, setStrokeStyle] = useState<"solid" | "dashed" | "dotted">(
    "solid",
  );
  const [strokeWidth, setStrokeWidth] = useState(2);

  const [opacity, setOpacity] = useState(1);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [toast, setToast] = useState<Toast | null>(null);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [showUsers, setShowUsers] = useState(false);

  const [users, setUsers] = useState<User[]>([]);

  const [showResizeMsg,setShowResizeMsg] = useState(false);

  const [fontSize,setFontSize] = useState(24);
  const [fontFamily,setFontFamily] = useState<"sans"|"mono"|"serif">("sans");
  const [fontWeight,setFontWeight] = useState<"normal"|"bold">("normal");
  const [fontStyle,setFontStyle] = useState<"normal"|"italic">("normal");
  const [textAlign,setTextAlign] = useState<"left"|"center"|"right">("left");

  const [canShowTextProperty,setCanShowTextProperty] = useState<boolean>(false);

  const [isOwner,setIsOwner] = useState<boolean>(false);
  const [displayOwnerMsg,setdisplayOwnerMsg] = useState(false);
  const [displayResetConfirm, setDisplayResetConfirm] = useState(false);

  const [presentationModal, setPresentationModal] = useState<PresentationModalConfig | null>(null);

  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const [presentationRole, setPresentationRole] = useState<"presenter" | "viewer" | null>(null);

  const [viewerMode, setViewerMode] = useState<"follow" | "explore">("follow");

  const [presentationInviteOpen, setPresentationInviteOpen] = useState(false);

  useEffect(() => {
    if (canvasref.current) {
      const g = new Game(canvasref.current, roomId, socket);
      setGame(g);
      return () => g.destroy();
    }
  }, [roomId, socket]);

  useEffect(() => {
    game?.setSelectedTool(selectedTool);
    game?.setSelectionListener(setShapeSelected);
    game?.setToolListener(setSelectedTool);
    game?.setOnlineUsersListener(setOnlineUsers); 
    game?.setUsersListener(setUsers);   
    game?.setShowResizeMsg(setShowResizeMsg);
    game?.setShowTextProperty(setCanShowTextProperty);
  }, [game,selectedTool,canShowTextProperty]);

  useEffect(()=>{
    game?.setSnapToGrid(snapToGrid);
  },[game,snapToGrid]);

  useEffect(()=>{
    game?.setIsLocked(isLocked);
  },[game,isLocked]);

  useEffect(()=>{
    game?.setScaleChangeListener((newScale: number) => {
      setScale(newScale);
    }); 
  },[game]);

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

  useEffect(() => {
    if (!game) return;

    let timer: any;

    game.setToastListener((toastData) => {
      setToast(toastData);

      clearTimeout(timer);

      timer = setTimeout(() => {
        setToast(null);
      }, 3000);
    });

    return () => clearTimeout(timer);
  }, [game]);

  useEffect(()=>{
    game?.setIsOwnerListener(setIsOwner);
  },[game]);

  useEffect(()=>{
    game?.setStrokeColor(strokeColor);
    game?.updateSelectedShape({
      strokeColor: strokeColor
    })
  },[game,strokeColor]);

  useEffect(()=>{
    game?.setStrokeWidth(strokeWidth);
    game?.updateSelectedShape({
      strokeWidth: strokeWidth
    })
  },[game,strokeWidth]);

  useEffect(()=>{
    game?.setStrokeStyle(strokeStyle);
    game?.updateSelectedShape({
      strokeStyle: strokeStyle
    })
  },[game,strokeStyle]);

  useEffect(()=>{
    game?.setFillColor(fillColor);
    game?.updateSelectedShape({
      fillColor: fillColor
    })
  },[game,fillColor]);

  useEffect(()=>{
    game?.setFillStyle(fillStyle);
    game?.updateSelectedShape({
      fillStyle: fillStyle
    })
  },[game,fillStyle]);

  useEffect(()=>{
    game?.setOpacity(opacity);
    game?.updateSelectedShape({
      opacity: opacity
    })
  },[game,opacity]);

  useEffect(()=>{
    game?.setTextStyle(
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      textAlign
    );
  },[game,fontFamily,fontSize,fontStyle,fontWeight,textAlign]);

  const onZoomIn = () => {
    if (scale >= 1.5) return;
    const newScale = Number((scale + 0.1).toFixed(1));
    game?.setScale(newScale);
  };

  const onZoomOut = () => {
    if (scale <= 0.5) return;
    const newScale = Number((scale - 0.1).toFixed(1));
    game?.setScale(newScale);
  };

  const onUndo = () => {
    game?.undo();
  };

  const onRedo = () => {
    game?.redo();
  };

  const onToggle = () => {
    game?.toggleGrid();
  };

  const onSnapToggle = () => {
    setSnapToGrid((prev) => !prev);
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

  const onDuplicate = () => {
    game?.duplicateShape();
  };

  const onDelete = () => {
    game?.deleteSelectedShape();
  };

  const onResetCanvas = () => {
    game?.finishTextEditing();
    if(!isOwner){
      setdisplayOwnerMsg(true);
      return;
    }
    setDisplayResetConfirm(true);
  }

  const onFitToScreen = () => {
    game?.fitToScreen();
  }
  
  const onPresentation = () => {
    setPresentationModal({
      title: "Start Presentation?",
      message:
        "Starting a presentation makes the whiteboard read-only while you present. You can pan, zoom, point, and use the laser pointer, but you cannot edit the board.",
      buttonText: "Start Presentation",
      onAction: () => {
        game?.fitToScreen();
        game?.startPresentation();

        setPresentationModal(null);
        setPresentationRole("presenter");
        setIsPresentationMode(true);
        setSelectedTool("hand");
      },
    });
  };

  useEffect(()=>{
    game?.setPresentationInviteListener(setPresentationInviteOpen);
  },[game,presentationInviteOpen]);

  const onJoinPresentation = () => {
    setPresentationInviteOpen(false);
    setIsPresentationMode(true);
    setViewerMode("follow");
    setPresentationRole("viewer");
    game?.joinPresentation();
  };

  const onRequestEndPresentation = () => { // kaam ka
    setPresentationModal({
      title: "End Presentation?",
      message:
        "Are you sure you want to end the presentation for everyone in this room?",
      buttonText: "End Presentation",
      onAction: () => {
        setPresentationModal(null);
        game?.endPresentation();
      },
    });
  };

  useEffect(() => {
    game?.setViewerFollowMode(presentationRole === "viewer" && viewerMode === "follow");
  }, [game, presentationRole, viewerMode]);

  useEffect(() => {
    game?.setPresentationEndedListener((wasViewer: boolean) => {
      setIsPresentationMode(false);
      setPresentationRole(null);
      setPresentationInviteOpen(false);
      setViewerMode("follow");
      setSelectedTool("hand");

      if (wasViewer) {
      setPresentationModal({
        title: "Presentation Ended",
        message: "The presenter has ended the presentation. You can now use the whiteboard normally.",
        buttonText: "Continue",
        onAction: () => {
          game?.resetCanvas();
          setPresentationModal(null)
        },
        buttonVariant: "purple"
      });
      }
    });
  }, [game]);

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
      {!isPresentationMode && <Topbar
        strokeColor={strokeColor}
        setSelectedTool={setSelectedTool}
        shapeSelected={shapeSelected}
        selectedTool={selectedTool}
        onRedo={onRedo}
        onUndo={onUndo}
        isLocked={isLocked}
        isSnapToGrid={snapToGrid}
        setIsLocked={setIsLocked}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onToggle={onToggle}
        onSnapToggle={onSnapToggle}
        onResetCanvas={onResetCanvas}
      />}

      {!isPresentationMode && <aside className="bg-black absolute top-1/2 left-5 -translate-y-1/2 w-60 rounded-2xl border border-border bg-card/95 backdrop-blur p-4 shadow-2xl shadow-black/40 ring-1 ring-white/5 space-y-4 max-h-[80vh] overflow-y-auto">
      {selectedTool === "text" || canShowTextProperty ? (
          <TextProperties
              strokeColor={strokeColor}
              setStrokeColor={setStrokeColor}

              fontSize={fontSize}
              setFontSize={setFontSize}

              fontFamily={fontFamily}
              setFontFamily={setFontFamily}

              fontWeight={fontWeight}
              setFontWeight={setFontWeight}

              fontStyle={fontStyle}
              setFontStyle={setFontStyle}

              textAlign={textAlign}
              setTextAlign={setTextAlign}

              opacity={opacity}
              setOpacity={setOpacity}
            />
        ) : (
          <>
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
        <SegRow
          label="Fill Style"
          options={FILL_STYLES}
          value={fillStyle}
          onChange={(v) =>
            setFillStyle(v as "solid" | "cross-hatch" | "hachure")
          }
        />
        <div>
          <p className="text-gray-300 text-xs font-medium text-muted-foreground mb-2">
            Stroke width
          </p>
          <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-border/60">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setStrokeWidth(w)}
                aria-label={`${w}px`}
                className={`flex-1 h-9 rounded-md flex items-center justify-center transition-colors ${
                  strokeWidth === w
                    ? "bg-gray-900 ring-1 ring-amber-600"
                    : "hover:bg-muted/60"
                }`}
              >
                <span
                  className="w-8 rounded-full bg-white"
                  style={{ height: w }}
                />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-gray-300 text-xs font-medium text-muted-foreground mb-2">
            Stroke style
          </p>
          <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-border/60">
            {STROKE_STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setStrokeStyle(s)}
                aria-label={s}
                className={`flex-1 h-9 rounded-md flex items-center justify-center transition-colors ${
                  strokeStyle === s
                    ? "bg-muted ring-1 ring-amber-600"
                    : "hover:bg-muted/60"
                }`}
              >
                <svg width="32" height="8" viewBox="0 0 32 8">
                  <line
                    x1="2"
                    y1="4"
                    x2="30"
                    y2="4"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={
                      s === "dashed"
                        ? "6 4"
                        : s === "dotted"
                          ? "1 4"
                          : undefined
                    }
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-gray-300 text-xs font-medium text-muted-foreground mb-2">
            Opacity
          </p>
          <input
            type="range"
            min={0}
            max={100}
            value={opacity * 100}
            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            className="w-full accent-primary"
          />
          <p className="text-right text-xs text-muted-foreground">
            {Math.round(opacity * 100)}%
          </p>
        </div>

        <div>
          <p className="text-gray-300 text-xs font-medium mb-2">Layer</p>

          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => game?.bringForward()}
              className="cursor-pointer h-10 rounded-md bg-black/40 border border-border hover:bg-muted flex items-center justify-center"
              title="Bring Forward"
            >
              <MoveUp size={18} />
            </button>

            <button
              onClick={() => game?.sendBackward()}
              className="cursor-pointer h-10 rounded-md bg-black/40 border border-border hover:bg-muted flex items-center justify-center"
              title="Send Backward"
            >
              <MoveDown size={18} />
            </button>

            <button
              onClick={() =>(console.log('clicked bring to front'), game?.bringToFront())}
              className="cursor-pointer h-10 rounded-md bg-black/40 border border-border hover:bg-muted flex items-center justify-center"
              title="Bring To Front"
            >
              <BringToFront size={18} />
            </button>

            <button
              onClick={() => game?.sendToBack()}
              className="cursor-pointer h-10 rounded-md bg-black/40 border border-border hover:bg-muted flex items-center justify-center"
              title="Send To Back"
            >
              <SendToBack size={18} />
            </button>
          </div>
        </div>
        </>
        )}
      </aside>}

      {!isPresentationMode && <div className="fixed top-5 right-5 z-40 flex items-center gap-2">

        <button
          onClick={() => setShowUsers((s) => !s)}
          className="inline-flex items-center cursor-pointer gap-2 px-3.5 py-2 rounded-xl border-white/35 text-sm font-medium bg-card text-foreground border border-border shadow-sm hover:border-primary/60 hover:-translate-y-0.5 transition-all"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <Users className="w-4 h-4 text-muted-foreground text-white" />
          <span className="tabular-nums text-white">{onlineUsers} online</span>
        </button>

        <button
          onClick={onPresentation}
          title="Presentation mode"
          aria-label="Presentation mode"
          className="
            group
            inline-flex h-10 w-10
            items-center justify-center
            rounded-xl
            bg-violet-500
            text-white
            shadow-md
            transition-all duration-200
            hover:-translate-y-0.5
            hover:bg-violet-600
            hover:shadow-lg
            active:translate-y-0
            cursor-pointer
          ">
          <MonitorPlay
            size={18}
            strokeWidth={1.9}
            className="transition-transform duration-200 group-hover:scale-105"
          />
        </button>

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
      </div>}

      {isPresentationMode && presentationRole === "presenter" && (
        <div className="fixed top-4 left-1/2 z-50 flex w-max max-w-[calc(100vw-16px)] -translate-x-1/2 flex-nowrap items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-neutral-900/95 px-3 py-2 text-white shadow-2xl backdrop-blur-xl">
          <span className="flex shrink-0 items-center gap-2 px-2 text-xs font-semibold text-white/90">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Presenting
          </span>

          <div className="h-6 w-px shrink-0 bg-white/15" />

          <div className="flex shrink-0 items-center gap-1 rounded-xl bg-white/[0.07] p-1">
            <button
              onClick={() => setSelectedTool("hand")}
              title="Pan canvas"
              aria-label="Pan canvas"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                selectedTool === "hand"
                  ? "bg-blue-600 text-white"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Hand size={17} />
            </button>

            <button
              onClick={() => setSelectedTool("select")}
              title="Cursor"
              aria-label="Cursor"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                selectedTool === "select"? "bg-blue-600 text-white": "text-white/75 hover:bg-white/10 hover:text-white"}`}>
              <MousePointer size={17} />
            </button>

            <button
              onClick={() => {
                setSelectedTool("laser");
                setStrokeColor("#ef4444");
              }}
              title="Laser pointer"
              aria-label="Laser pointer"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                selectedTool === "laser"? "bg-blue-600 text-white": "text-white/75 hover:bg-white/10 hover:text-white"}`}>
              <LaserPointer
                color={selectedTool === "laser" ? "#ffffff" : "#ef4444"}
                className="h-4.25 w-4.25"
              />
            </button>
          </div>

          <div className="flex h-11 shrink-0 items-center gap-0.5 rounded-xl bg-white/[0.07] p-1">
            <button
              onClick={onZoomOut}
              title="Zoom out"
              aria-label="Zoom out"
              className="flex h-9 w-8 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <ZoomOut size={16} />
            </button>

            <span className="min-w-11 px-1 text-center text-xs font-semibold tabular-nums">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={onZoomIn}
              title="Zoom in"
              aria-label="Zoom in"
              className="flex h-9 w-8 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          <button
            onClick={onFitToScreen}
            title="Fit canvas to screen"
            aria-label="Fit canvas to screen"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <Maximize size={17} />
          </button>

          <div className="h-6 w-px shrink-0 bg-white/15" />

          <button
            onClick={onRequestEndPresentation}
            title="End presentation for everyone"
            aria-label="End presentation for everyone"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-500"
          >
            <MonitorPlay size={15} />
            End
          </button>

          {/* Exit for presenter only */}
          <button
            onClick={onLeave}
            title="Leave presentation"
            aria-label="Leave presentation"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-red-500/10 px-3 text-xs font-semibold text-red-400 transition hover:bg-red-500 hover:text-white"
          >
            <ArrowRight size={15} />
            Exit
          </button>
        </div>
      )}

      {isPresentationMode && presentationRole === "viewer" && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-nowrap items-center gap-1.5 w-max max-w-[calc(100vw-16px)] overflow-x-auto rounded-2xl border border-white/10 bg-neutral-900/95 px-2.5 py-2 text-white shadow-2xl backdrop-blur-xl">

          <span className="flex shrink-0 items-center gap-2 px-2 text-xs font-semibold text-white/90">
            {viewerMode === "follow" ? (
              <Users size={15} className="text-sky-400" />
            ) : (
              <MousePointer size={15} className="text-sky-400" />
            )}
            {viewerMode === "follow" ? "Following presenter" : "Exploring"}
          </span>

          <button
            onClick={() =>
              setViewerMode(mode => mode === "follow" ? "explore" : "follow")
            }
            title={viewerMode === "follow" ? "Explore independently" : "Follow presenter"}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition cursor-pointer ${
              viewerMode === "follow"? "bg-white/[0.07] text-white/85 hover:bg-white/10": "bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
            }`}>
            {viewerMode === "follow" ? (
              <>
                <MousePointer size={15} />
                Explore
              </>
            ) : (
              <>
                <MonitorPlay size={15} />
                Follow
              </>
            )}
          </button>

          <div className="flex shrink-0 items-center gap-1 rounded-xl bg-white/[0.07] p-1">
            <button
              onClick={() => setSelectedTool("hand")}
              title="Pan canvas"
              aria-label="Pan canvas"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition cursor-pointer ${
                selectedTool === "hand"
                  ? "bg-blue-600 text-white"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Hand size={17} />
            </button>

            <button
              onClick={() => setSelectedTool("select")}
              title="Cursor"
              aria-label="Cursor"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition cursor-pointer ${
                selectedTool === "select"
                  ? "bg-blue-600 text-white"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <MousePointer size={17} />
            </button>

            <button
              onClick={() => setSelectedTool("laser")}
              title="Laser pointer"
              aria-label="Laser pointer"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition cursor-pointer ${
                selectedTool === "laser"
                  ? "bg-blue-600 text-white"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <LaserPointer
                color={selectedTool === "laser" ? "#ef4444" : "#ffffff"}
                className="h-4.25 w-4.25"
              />
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-white/[0.07] p-1">
            <button
              onClick={onZoomOut}
              title="Zoom out"
              aria-label="Zoom out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <ZoomOut size={16} />
            </button>

            <span className="min-w-11 px-1 text-center text-xs font-semibold tabular-nums">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={onZoomIn}
              title="Zoom in"
              aria-label="Zoom in"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          <button
            onClick={onLeave}
            title="Leave presentation"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-red-500/10 px-3 text-xs font-semibold text-red-400 transition hover:bg-red-500 hover:text-white cursor-pointer"
          >
            <ArrowRight size={15} />
            Exit
          </button>
        </div>
      )}

      {showUsers && (
        <UsersPanel users={users} onClose={() => setShowUsers(false)} />
      )}

      {toast && (
        <div className="toast">
          <div
            className="toast-dot"
            style={{
              backgroundColor: toast.color,
            }}
          />

          {toast.message}
        </div>
      )}

      {!isPresentationMode && (<div
        className="zoom-controls"
        style={{
          cursor: "pointer",
          position: "fixed",
          bottom: 12,
          left: 20,
          display: "flex",
          alignItems: "center",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          padding: "4px 6px",
          borderRadius: "14px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          zIndex: 50,
          gap: "8px",
        }}
      >
        <ToolButton
          onClick={onZoomOut}
          title="Zoom out"
          icon={<ZoomOut size={15} />}
        />

        <span
          style={{
            width: "42px",
            textAlign: "center",
            fontSize: "12px",
            fontWeight: 500,
            lineHeight: "30px",
            color: "#000",
            userSelect: "none",
          }}
        >
          {Math.round(scale * 100)}%
        </span>

        <ToolButton
          onClick={onZoomIn}
          title="Zoom in"
          icon={<ZoomIn size={15} />}
        />

        <Divider/>

        <ToolButton
          onClick={onFitToScreen}
          title="Fit to screen"
          icon={<Maximize size={15} />}
        />
      </div>)}

      {showResizeMsg && (
        <MessageModal title="Resize Text Info 💡" onClose={()=>setShowResizeMsg(false)} message="Drag to scale your text. Hold Shift while dragging to wrap the text."></MessageModal>
      )}

      {displayOwnerMsg && (
        <MessageModal  onClose={()=>setdisplayOwnerMsg(false)} message="Only the owner of the room can reset the canvas."></MessageModal>
      )}

      {displayResetConfirm && (
        <ConfirmModal open={displayResetConfirm} title="Reset Canvas?" description="This will permanently remove all shapes from this canvas. This action cannot be undone." 
        confirmWord="CONFIRM" confirmLabel="Reset Canvas" tone="danger"
        onConfirm={() => {
          setDisplayResetConfirm(false);
          game?.resetCanvas();
        }}
        onCancel={() => setDisplayResetConfirm(false)} />
      )}
    
      {presentationModal && (
        <MessageModal
          title={presentationModal.title}
          message={presentationModal.message}
          buttonText={presentationModal.buttonText}
          onClose={() => setPresentationModal(null)}
          onAction={presentationModal.onAction}
          dismissible={presentationModal.dismissible ?? true}
        />
      )}

      {presentationInviteOpen && !isPresentationMode && (
        <MessageModal
          title="Presentation Invitation"
          message="Someone has started presenting the whiteboard. Would you like to join and follow their view?"
          buttonText="Join Presentation"
          onClose={() => setPresentationInviteOpen(false)}
          onAction={onJoinPresentation}
          buttonVariant="purple"
        />
      )}

    </div>
  );
}

function Topbar({
  strokeColor,
  selectedTool,
  setSelectedTool,
  shapeSelected,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  onToggle,
  onSnapToggle,
  onResetCanvas,
  isSnapToGrid,
  isLocked,
  setIsLocked,
}: {
  strokeColor: string;
  selectedTool: Tool;
  setSelectedTool: (s: Tool) => void;
  shapeSelected: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onToggle?: () => void;
  onSnapToggle?: () => void;
  onResetCanvas?: () => void;
  isSnapToGrid: boolean;
  isLocked: boolean;
  setIsLocked: (s: boolean) => void;
}) {
  return (
    <div
      style={{
        cursor: "pointer",
        position: "fixed",
        top: 20,
        left: "calc(50% - 50px)",
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
        title="Lock Screen"
        onClick={() => (isLocked ? setIsLocked(false) : setIsLocked(true))}
        icon={
          isLocked ? <LockKeyhole size={18} /> : <LockKeyholeOpen size={18} />
        }
      />

      <Divider />

      <ToolButton
        active={selectedTool === "laser"}
        title="Laser Pointer (Z)"
        onClick={() => setSelectedTool("laser")}
        icon={<LaserPointer color={strokeColor} />}
      />

      <ToolButton
        active={selectedTool === "select"}
        title="Select (V)"
        onClick={() => setSelectedTool("select")}
        icon={<MousePointer size={18} />}
      />

      <ToolButton
        active={selectedTool === "hand"}
        title="Hand (H)"
        onClick={() => setSelectedTool("hand")}
        icon={<Hand size={18} />}
      />
      <ToolButton
        active={selectedTool === "pencil"}
        title="Pencil (P)"
        onClick={() => setSelectedTool("pencil")}
        icon={<Pencil size={18} />}
      />
      <ToolButton
        active={selectedTool === "arrow"}
        title="Arrow (A)"
        onClick={() => setSelectedTool("arrow")}
        icon={<ArrowRight size={18} />}
      />
      <ToolButton
        active={selectedTool === "line"}
        title="Line (L)"
        onClick={() => setSelectedTool("line")}
        icon={<Minus size={18} />}
      />
      <ToolButton
        active={selectedTool === "rect"}
        title="Rectangle (R)"
        onClick={() => setSelectedTool("rect")}
        icon={<RectangleHorizontalIcon size={18} />}
      />
      <ToolButton
        active={selectedTool === "ellipse"}
        title="Ellipse (E)"
        onClick={() => setSelectedTool("ellipse")}
        icon={<Circle size={18} />}
      />
      <ToolButton
        active={selectedTool === "diamond"}
        title="Diamond (D)"
        onClick={() => setSelectedTool("diamond")}
        icon={<Diamond size={18} />}
      />
      <ToolButton
        active={selectedTool === "text"}
        title="Text (T)"
        onClick={() => setSelectedTool("text")}
        icon={<Type size={18} />}
      />

      <Divider />

      <ToolButton
        onClick={onUndo}
        title="Undo (Ctrl+Z)"
        disabled={false}
        icon={<Undo2 size={18} />}
      />
      <ToolButton
        onClick={onRedo}
        title="Redo (Ctrl+Shift+Z)"
        disabled={false}
        icon={<Redo2 size={18} />}
      />

      <Divider />

      <ToolButton
        onClick={onSnapToggle}
        title="Snap to Grid"
        active={isSnapToGrid}
        icon={<Grid2X2Check size={18} />}
      />
      <ToolButton
        onClick={onToggle}
        title="Toggle Grid"
        icon={<Grid3X3 size={18} />}
      />
      <ToolButton
        onClick={onDuplicate}
        title="Duplicate (Ctrl+D)"
        disabled={!shapeSelected}
        icon={<CopyPlus size={18} />}
      />
      <ToolButton
        onClick={onDelete}
        title="Delete (Del)"
        disabled={!shapeSelected}
        icon={<Trash2 size={18} />}
      />

      <Divider/>

      <ToolButton
        onClick={onResetCanvas}
        title="Clear Canvas"
        icon={<PaintRoller size={18} />}
      />
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  icon,
  disabled = false,
  title,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: "10px",
        border: "none",
        background: active ? "#111" : "transparent",
        color: active ? "#fff" : "#333",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s ease",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
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
        <p className="text-gray-300 text-xs font-medium text-muted-foreground">
          {label}
        </p>
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
                ? "border-primary ring-2 ring-orange-400"
                : "border-border hover:border-orange-200"
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
      <p className="text-gray-300 text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-border/60">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            title={o}
            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
              value === o
                ? "bg-gray-600 text-foreground ring-2 ring-primary/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function UsersPanel({
  users,
  onClose,
}: {
  users: { id: number; name: string; color: string; you?: boolean }[];
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="absolute inset-0 z-20 border-white"
        onClick={onClose}
        aria-hidden
      />
      <aside className="absolute top-16 right-5 z-30 w-64 rounded-2xl border border-border bg-card/95 backdrop-blur p-3 shadow-2xl shadow-black/60 ring-1 ring-white/5">
        <div className="flex items-center justify-between px-1 pb-2 mb-2 border-white/35 border-b border-border/60">
          <div className="flex items-center gap-2 border-white/35">
            <Users className="w-4 h-4 text-muted-foreground text-white" />
            <span className="text-sm font-medium text-foreground text-white">
              In this room
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 text-white flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ul className="space-y-1 max-h-[60vh] overflow-y-auto text-white">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors"
            >
              <span
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: u.color }}
              >
                {u.name.charAt(0).toUpperCase()}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-card" />
              </span>
              <span className="flex-1 truncate text-sm text-foreground">
                {u.name}
                {u.you && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    you
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-2 px-2 text-[11px] text-muted-foreground text-white">
          {users.length} drawing together
        </p>
      </aside>
    </>
  );
}

function TextProperties({
  strokeColor,
  setStrokeColor,
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  fontWeight,
  setFontWeight,
  fontStyle,
  setFontStyle,
  textAlign,
  setTextAlign,
  opacity,
  setOpacity,
}: {
  strokeColor: string;
  setStrokeColor: (value: string) => void;

  fontSize: number;
  setFontSize: (value: number) => void;

  fontFamily: "sans" | "mono" | "serif";
  setFontFamily: (value: "sans" | "mono" | "serif") => void;

  fontWeight: "normal" | "bold";
  setFontWeight: (value: "normal" | "bold") => void;

  fontStyle: "normal" | "italic";
  setFontStyle: (value: "normal" | "italic") => void;

  textAlign: "left" | "center" | "right";
  setTextAlign: (value: "left" | "center" | "right") => void;

  opacity: number;
  setOpacity: (value: number) => void;
}) {
  return (
    <div className="space-y-4 text-foreground">

      <h2 className="text-xs font-semibold uppercase">
        Text
      </h2>

      <SwatchRow
        label="Color"
        colors={STROKE_COLORS}
        value={strokeColor}
        onChange={setStrokeColor}
      />

      <SegRow
        label="Font"
        options={["sans", "serif", "mono"]}
        value={fontFamily}
        onChange={(v) =>
          setFontFamily(v as "sans" | "serif" | "mono")
        }
      />

      <div>
        <p className="text-gray-300 text-xs font-medium text-muted-foreground mb-2">
          Size
        </p>

        <input
          type="number"
          min={8}
          max={144}
          value={fontSize}
          onChange={(e) => {
            const value = e.target.valueAsNumber;

            if (Number.isFinite(value)) {
              setFontSize(
                Math.min(144, Math.max(8, value))
              );
            }
          }}
          className="w-full h-9 rounded-md border border-border bg-muted/40 px-2.5 text-sm"
        />
      </div>

      <div>
        <p className="text-gray-300 text-xs font-medium text-muted-foreground mb-2">
          Style
        </p>

        <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-border/60">

          <button
            onClick={() =>
              setFontWeight(
                fontWeight === "bold"
                  ? "normal"
                  : "bold"
              )
            }
            className={`flex-1 h-9 rounded-md ${
              fontWeight === "bold"
                ? "bg-gray-900 ring-1 ring-amber-600"
                : "hover:bg-muted/60"
            }`}
          >
            <Bold size={16} className="mx-auto" />
          </button>

          <button
            onClick={() =>
              setFontStyle(
                fontStyle === "italic"
                  ? "normal"
                  : "italic"
              )
            }
            className={`flex-1 h-9 rounded-md ${
              fontStyle === "italic"
                ? "bg-gray-900 ring-1 ring-amber-600"
                : "hover:bg-muted/60"
            }`}
          >
            <Italic size={16} className="mx-auto" />
          </button>

        </div>
      </div>

      <div>
        <p className="text-gray-300 text-xs font-medium text-muted-foreground mb-2">
          Align
        </p>

        <div className="flex gap-1 p-1 rounded-lg bg-black/40 border border-border/60">

          <button
            onClick={() => setTextAlign("left")}
            className={`flex-1 h-9 rounded-md ${
              textAlign === "left"
                ? "bg-gray-900 ring-1 ring-amber-600"
                : "hover:bg-muted/60"
            }`}
          >
            <AlignLeft size={16} className="mx-auto" />
          </button>

          <button
            onClick={() => setTextAlign("center")}
            className={`flex-1 h-9 rounded-md ${
              textAlign === "center"
                ? "bg-gray-900 ring-1 ring-amber-600"
                : "hover:bg-muted/60"
            }`}
          >
            <AlignCenter size={16} className="mx-auto" />
          </button>

          <button
            onClick={() => setTextAlign("right")}
            className={`flex-1 h-9 rounded-md ${
              textAlign === "right"
                ? "bg-gray-900 ring-1 ring-amber-600"
                : "hover:bg-muted/60"
            }`}
          >
            <AlignRight size={16} className="mx-auto" />
          </button>

        </div>
      </div>

      <div>
        <p className="text-gray-300 text-xs font-medium text-muted-foreground mb-2">
          Opacity
        </p>

        <input
          type="range"
          min={0}
          max={100}
          value={opacity * 100}
          onChange={(e) =>
            setOpacity(Number(e.target.value) / 100)
          }
          className="w-full"
        />
      </div>

    </div>
  );
}

function LaserPointer({ color = "#ef4444", className = "h-6 w-6" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >

      <path
        d="M8.5 2.8
           C5.5 2.2, 3.8 4.2, 5.2 5.8
           C6.3 7.1, 9.2 6.4, 9.4 8.2
           C9.6 10.1, 7.1 10.8, 4.8 9.8"
        stroke={color}
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
      />

      <path d="M10.5 7 L22.5 19 L19 22.5 L7.5 11 Z" />

      <line x1="19.5" y1="15.5" x2="15.5" y2="19.5" />

      <path
        d="M7.5 11 L10.5 7 L7 5.8 L5.8 7.2 Z"
        fill={color}
        stroke={color}
      />
    </svg>
  );
}