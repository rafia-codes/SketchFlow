import { Tool } from "../components/Canvas";
import {Shape,ShapeStyle,HistoryAction,Cursor,Toast,SelectionBound,RemoteSelection,User, TextShape,} from "./types";

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private roomId: string;
  private socket: WebSocket;
  private existingShapes: Shape[];
  private undoStack: HistoryAction[];
  private redoStack: HistoryAction[];
  private startX = 0;
  private startY = 0;
  private selectedTool: Tool = "rect";
  private isPanning = false;
  private hasMoved: boolean = false;
  private panX = 0;
  private panY = 0;
  private offsetX = 0;
  private offsetY = 0;
  private scale = 1;
  private readonly GRID_SIZE = 20;
  private snapToGrid: boolean;
  private isLocked = false;
  private previewshapes: Map<string, Shape>;
  private cursors: Map<string, Cursor>;
  private remoteSelections: Map<string, RemoteSelection>;
  private currentShape: Shape | null;
  private needsRender: boolean;
  private animationFrameId: number | null;
  private lastPreviewSent: number;
  private lastCursorSent: number = 0;
  private lastPreviewPoint: { x: number; y: number };
  private readonly PREVIEW_INTERVAL = 33;
  private readonly CURSOR_INTERVAL = 16;
  private selectedShapeId: string | null;
  private interaction: "idle"| "drawing"| "moving"| "resizing"| "marquee"| "groupMove"| "rotating" = "idle";
  private dragStart = { x: 0, y: 0 };
  private resizeHandle: "tl" | "tr" | "bl" | "br" | null = null;
  private textResizeMode: "scale" | "wrap" = "scale";

  private SELECTION_PADDING = 5;
  private HANDLE_SIZE = 8;

  private strokeColor: string;
  private fillColor: string;
  private strokeWidth: number;

  private strokeStyle: "solid" | "dashed" | "dotted";
  private fillStyle: "solid" | "cross-hatch" | "hachure";

  private opacity: number = 1;

  private textEditor: HTMLTextAreaElement | null = null;
  private textEditorX: number = 0;
  private textEditorY: number = 0;
  private editingTextShapeId: string | null = null;
  private textPreviewShapeId: string | null = null;

  private fontSize: number = 24;
  private fontFamily: "sans" | "mono" | "serif" = "sans";
  private fontWeight: "normal" | "bold" = "normal";
  private fontStyle: "normal" | "italic" = "normal";
  private textAlign: "left" | "center" | "right" = "left";

  private initialShape: Shape | null = null;
  private initialGroupShapes: Shape[] | null = null;
  private selectionListener?: (selected: boolean) => void;
  private toolListener?: (tool: Tool) => void;
  private clipboardShape: Shape | null;
  private clipboardShapes: Shape[] | null = null;
  private onlineUsers?: (usersOnline: number) => void;
  private toastListener?: (toast: Toast) => void;
  private isOwnerListener?: (valid: boolean) => void;
  private users: User[] = [];
  private usersListener?: (user: User[]) => void;
  private showGrid: boolean = true;
  private rotationStartAngle = 0;
  private initialRotation = 0;

  private selectionRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null = null;

  private marqueeStart = {
    x: 0,
    y: 0,
  };

  private groupSelection: {
    shapeIds: Set<string>;
    bounds: SelectionBound;
  } | null = null;

  private hasSeenTextResizeBehaviour: boolean = false ;
  private showMsgListener?: (show: boolean) => void;

  private canShowTextProperties? :(show: boolean) => void;
  private textEditorOutsideClickHandler: ((e: MouseEvent) => void) | null = null;

  private laserPoints: {x:number, y:number, time:number}[] = []; 
  private isLaserDrawing = false;
  private remoteLaserPoints = new Map<string,{points: { x: number; y: number; time: number }[], color: string}>();

  private readonly LASER_MAX_POINTS = 80;
  private readonly LASER_MIN_DISTANCE = 1.5;
  private readonly LASER_DURATION = 650;

  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.roomId = roomId;
    this.existingShapes = [];
    this.undoStack = [];
    this.redoStack = [];
    this.socket = socket;
    this.initHandlers();
    this.initMouseHandlers();
    this.initKeyboardhandlers();
    this.users.push({ id: 1, name: "You", color: "#FB8C00", you: true });
    this.isLocked = false;
    this.previewshapes = new Map<string, Shape>();
    this.cursors = new Map<string, Cursor>();
    this.remoteSelections = new Map<string, RemoteSelection>();
    this.currentShape = null;
    this.needsRender = true;
    this.animationFrameId = 0;
    this.lastPreviewSent = 0;
    this.lastPreviewPoint = { x: 0, y: 0 };
    this.selectedShapeId = null;
    this.clipboardShape = null;
    this.snapToGrid = false;
    this.strokeColor = "#ffffff";
    this.fillColor = "transparent";
    this.strokeWidth = 2 / this.scale;
    this.strokeStyle = "solid";
    this.fillStyle = "solid";
    this.render();
  }

  private getMousePos(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this.scale - this.offsetX,
      y: (e.clientY - rect.top) / this.scale - this.offsetY,
    };
  }

  setSelectionListener(callback: (selected: boolean) => void) {
    this.selectionListener = callback;
  }

  setToolListener(callback: (tool: Tool) => void) {
    this.toolListener = callback;
  }

  setOnlineUsersListener(callback: (online: number) => void) {
    this.onlineUsers = callback;
  }

  setUsersListener(callback: (user: User[]) => void) {
    this.usersListener = callback;
    this.usersListener([...this.users]);
  }

  setToastListener(callback: (toast: Toast) => void) {
    this.toastListener = callback;
  }

  setShowResizeMsg(callback: (show: boolean) => void){
    this.showMsgListener = callback;
  }

  setShowTextProperty(callback: (show: boolean) => void){
    this.canShowTextProperties = callback;
  }

  setSnapToGrid(val: boolean) {
    this.snapToGrid = val;
  }

  setIsLocked(isLocked: boolean) {
    this.isLocked = isLocked;
  }

  setSelectedTool(tool: Tool) {
    if (this.textEditor) {
      this.finishTextEditing();
    }
    this.selectedTool = tool;
    this.toolListener?.(tool);
    if (this.selectedTool !== "select") {
      this.selectedShapeId = null;
      this.canShowTextProperties?.(false);
      this.interaction = "idle";
      this.needsRender = true;
    }
    if(tool == "laser"){
      this.isLaserDrawing = false;
      this.setLaserCursor();
    }
    else{
      this.canvas.style.cursor = tool == "hand" ? "grab" : tool == "select" ? "default" : "crosshair";
    }
    this.laserPoints = [];
    this.shapeSelection?.(null);
  }

  setScale(newScale: number) {
    this.scale = newScale;
    this.needsRender = true;
  }

  setIsOwnerListener( callback: (yes: boolean) => void) {
    this.isOwnerListener = callback;
  }

  setStrokeColor(newStrokeColor: string) {
    this.strokeColor = newStrokeColor;
    if(this.textEditor){
      this.handleTextEditorInput();
      return;
    }
    if(this.selectedTool == "laser"){
      this.setLaserCursor();
    }
  }

  setFillColor(newFillColor: string) {
    this.fillColor = newFillColor;
  }

  setStrokeWidth(newStrokeWidth: number) {
    this.strokeWidth = newStrokeWidth;
  }

  setStrokeStyle(newStrokeStyle: "solid" | "dashed" | "dotted") {
    this.strokeStyle = newStrokeStyle;
  }

  setFillStyle(newFillStyle: "solid" | "cross-hatch" | "hachure") {
    this.fillStyle = newFillStyle;
  }

  setOpacity(newOpacity: number) {
    this.opacity = newOpacity;
  }

  setTextStyle(fontSize: number,fontFamily: "mono" | "sans" | "serif",fontWeight: "normal" | "bold",fontStyle: "normal" | "italic",textAlign: "left" | "center" | "right",) {
    this.fontSize = fontSize;
    this.fontFamily = fontFamily;
    this.fontWeight = fontWeight;
    this.fontStyle = fontStyle;
    this.textAlign = textAlign;

    if(this.textEditor){
      this.textEditor.style.fontSize = `${(fontSize * this.scale)}px`;
      this.textEditor.style.fontFamily =fontFamily === "serif"? "serif": fontFamily === "mono"? "monospace": "sans-serif";
      this.textEditor.style.fontWeight = fontWeight;
      this.textEditor.style.fontStyle = fontStyle;
      this.textEditor.style.textAlign = textAlign;

      this.handleTextEditorInput();
    }

    if(this.selectedShapeId){
      const shape = this.findShape(this.selectedShapeId);
      if(shape?.type == "text"){
        this.updateSelectedShape({fontFamily,fontSize,fontStyle,fontWeight,textAlign});
      }
    }
  }

  private setLaserCursor() { 
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path
        d="M9.8 6.8
          L22 18.9
          Q22.7 19.6 22 20.3
          L19.2 23
          Q18.5 23.7 17.8 23
          L6.2 11.4
          Z"
        fill="white"
        stroke="black"
        stroke-width="1.5"
        stroke-linejoin="round"
      />

      <path
        d="M6.2 11.4
          Q5.65 9.6 5.35 7.35
          Q5.2 6.25 6.25 6.45
          Q8.45 6.8 10.15 7.25
          L9.8 6.8
          Z"
        fill="${this.strokeColor}"
        stroke="black"
        stroke-width="1.15"
        stroke-linejoin="round"
      />

      <path
        d="M7 7.05
          Q7.8 7.2 9.15 7.55"
        fill="none"
        stroke="white"
        stroke-width="0.65"
        stroke-linecap="round"
        opacity="0.45"
      />
    </svg>
  `;

  this.canvas.style.cursor =
    `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 2, crosshair`;
  }

  private getCurrentStyling(): ShapeStyle {
    return {
      strokeColor: this.strokeColor,
      strokeStyle: this.strokeStyle,
      strokeWidth: this.strokeWidth,

      fillColor: this.fillColor,
      fillStyle: this.fillStyle,

      opacity: this.opacity,
      zIndex: this.getNextZIndex(),
    };
  }

  private shapeSelection(id: string | null) {
    this.selectedShapeId = id;
    this.groupSelection = null;
    this.currentShape = null;
    this.selectionListener?.(id !== null);
    this.needsRender = true;
    this.broadcastSelection(false);
  }

  private groupSelected() {
    this.selectedShapeId = null;
    this.canShowTextProperties?.(false);
    this.currentShape = null;
    this.selectionListener?.(this.groupSelection !== null);
    this.needsRender = true;
    this.broadcastSelection(false);
  }

  private getLeftTopWidthHeight(shape: Shape): {
    left: number;
    top: number;
    width: number;
    height: number;
  } {
    switch (shape.type) {
      case "rect":
        return {
          left: shape.x,
          top: shape.y,
          width: shape.width,
          height: shape.height,
        };

      case "ellipse":
        return {
          left: shape.centerX - shape.radX,
          top: shape.centerY - shape.radY,
          width: shape.radX * 2,
          height: shape.radY * 2,
        };

      case "diamond":
        return {
          left: shape.left,
          top: shape.top,
          width: shape.width,
          height: shape.height,
        };

      case "line":
      case "arrow":
        return {
          left: Math.min(shape.sX, shape.eX),
          top: Math.min(shape.sY, shape.eY),
          width: Math.abs(shape.eX - shape.sX),
          height: Math.abs(shape.eY - shape.sY),
        };

      case "pencil":
        const xs = shape.points.map((p) => p.x);
        const ys = shape.points.map((p) => p.y);

        const left = Math.min(...xs);
        const top = Math.min(...ys);

        return {
          left,
          top,
          width: Math.max(...xs) - left,
          height: Math.max(...ys) - top,
        };

      case "text":
        return {
          left: shape.x,
          top: shape.y,
          width: shape.width,
          height: shape.height,
        };
        break;
    }
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  private drawBox(left: number, top: number, width: number, height: number) {
    this.ctx.save();
    this.ctx.strokeRect(
      left - this.SELECTION_PADDING,
      top - this.SELECTION_PADDING,
      width + this.SELECTION_PADDING * 2,
      height + this.SELECTION_PADDING * 2,
    );
    this.ctx.restore();
  }

  private getHandles(left: number, top: number, width: number, height: number) {
    const handles = [
      {
        x: left - this.SELECTION_PADDING,
        y: top - this.SELECTION_PADDING,
        dir: "tl",
      },
      {
        x: left + width + this.SELECTION_PADDING,
        y: top - this.SELECTION_PADDING,
        dir: "tr",
      },
      {
        x: left - this.SELECTION_PADDING,
        y: top + height + this.SELECTION_PADDING,
        dir: "bl",
      },
      {
        x: left + width + this.SELECTION_PADDING,
        y: top + height + this.SELECTION_PADDING,
        dir: "br",
      },
    ];
    return handles;
  }

  private drawHandles(handles: { x: number; y: number; dir: string }[]) {
    this.ctx.fillStyle = "#3b82f6";

    handles.map((h: any) => {
      this.ctx.fillRect(
        h.x - this.HANDLE_SIZE / 2,
        h.y - this.HANDLE_SIZE / 2,
        this.HANDLE_SIZE,
        this.HANDLE_SIZE,
      );
    });
  }

  private getRotationHandle(handles: { x: number; y: number; dir: string }[]) {
    const tl = handles.find((h) => h.dir == "tl");
    const tr = handles.find((h) => h.dir == "tr");

    const cx = (tl!.x + tr!.x) / 2;
    const cy = (tl!.y + tr!.y) / 2;

    const offset = 25 / this.scale;

    const rx = cx,
      ry = cy - offset;

    return { cx, cy, rx, ry };
  }

  private drawRotationHandle(handles: { x: number; y: number; dir: string }[]) {
    this.ctx.save();

    const { cx, cy, rx, ry } = this.getRotationHandle(handles);

    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(rx, ry);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(rx, ry, 6 / this.scale, 0, Math.PI * 2);
    this.ctx.strokeStyle = "#3b82f6";
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawSelectionBox(shape: Shape, color: string = "#3b82f6") {
    this.ctx.save();

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = this.strokeWidth / this.scale;

    const { left, top, width, height } = this.getLeftTopWidthHeight(shape);

    const cx = left + width / 2;
    const cy = top + height / 2;

    if (shape.rotation) {
      this.ctx.translate(cx, cy);
      this.ctx.rotate(shape.rotation);
      this.ctx.translate(-cx, -cy);
    }
    this.drawBox(left, top, width, height);
    const handles = this.getHandles(left, top, width, height);
    if (color == "#3b82f6") {
      this.drawRotationHandle(handles);
      this.drawHandles(handles);
    }

    this.ctx.restore();
  }

  private isOnRotationHandle(shape: Shape, x: number, y: number) {
    const { left, top, width, height } = this.getLeftTopWidthHeight(shape);
    const handles = this.getHandles(left, top, width, height);

    const { rx, ry } = this.getRotationHandle(handles);
    const distance = Math.sqrt((x - rx) ** 2 + (y - ry) ** 2);

    return distance <= 20 / this.scale;
  }

  snap(val: number) {
    if (!this.snapToGrid) return val;
    return Math.round(val / this.GRID_SIZE) * this.GRID_SIZE;
  }

  private drawGrid() {
    const left = -this.offsetX;
    const top = -this.offsetY;
    const right = left + this.canvas.width / this.scale;
    const bottom = top + this.canvas.height / this.scale;

    const startX = Math.floor(left / this.GRID_SIZE) * this.GRID_SIZE;
    const startY = Math.floor(top / this.GRID_SIZE) * this.GRID_SIZE;

    this.ctx.beginPath();
    this.ctx.strokeStyle = "#1f1f1f";
    this.ctx.lineWidth = 1 / this.scale;

    for (let x = startX; x <= right; x += this.GRID_SIZE) {
      this.ctx.moveTo(x, top);
      this.ctx.lineTo(x, bottom);
    }

    for (let y = startY; y <= bottom; y += this.GRID_SIZE) {
      this.ctx.moveTo(left, y);
      this.ctx.lineTo(right, y);
    }

    this.ctx.stroke();
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    this.needsRender = true;
  }

  resetCanvas(){
    if(this.textEditor){
      this.removeTextEditor();
    }
    if(this.socket.readyState == WebSocket.OPEN){
      this.socket.send(JSON.stringify({
        type:"chats:reset",
        roomId: this.roomId
      }))
    }
    console.log("reset req sent to backend");
  }

  private isPointOnRect(x: number,y: number,shape: Extract<Shape, { type: "rect" }>): boolean {
    const padding = 5 / this.scale;

    return (
      shape.x - padding <= x &&
      x <= shape.x + shape.width + padding &&
      shape.y - padding <= y &&
      y <= shape.y + shape.height + padding
    );
  }

  private isPointOnEllipse(x: number,y: number,shape: Extract<Shape, { type: "ellipse" }>): boolean {
    const padding = 5 / this.scale;

    const dx = x - shape.centerX;
    const dy = y - shape.centerY;

    const rX = shape.radX + padding;
    const rY = shape.radY + padding;

    return (dx * dx) / (rX * rX) + (dy * dy) / (rY * rY) <= 1;
  }

  private isPointOnDiamond(x: number,y: number,shape: Extract<Shape, { type: "diamond" }>): boolean {
    const padding = 5 / this.scale;

    const dx = Math.abs(x - shape.centerX);
    const dy = Math.abs(y - shape.centerY);

    const halfWidth = shape.width / 2 + padding;
    const halfHeight = shape.height / 2 + padding;

    return dx / halfWidth + dy / halfHeight <= 1;
  }

  private isPointOnLine(x: number,y: number,shape: Extract<Shape, { type: "line" }>): boolean {
    const padding = 5 / this.scale;

    const minX = Math.min(shape.sX, shape.eX) - padding;
    const minY = Math.min(shape.eY, shape.sY) - padding;
    const maxX = Math.max(shape.sX, shape.eX) + padding;
    const maxY = Math.max(shape.eY, shape.sY) + padding;

    return minX <= x && x <= maxX && minY <= y && y <= maxY;
  }

  private isPointOnArrow(x: number,y: number,shape: Extract<Shape, { type: "arrow" }>): boolean {
    const padding = 5 / this.scale;

    const minX = Math.min(shape.sX, shape.eX) - padding;
    const minY = Math.min(shape.eY, shape.sY) - padding;
    const maxX = Math.max(shape.sX, shape.eX) + padding;
    const maxY = Math.max(shape.eY, shape.sY) + padding;

    return minX <= x && x <= maxX && minY <= y && y <= maxY;
  }

  private isPointOnPencil(x: number,y: number,shape: Extract<Shape, { type: "pencil" }>): boolean {
    const padding = 5 / this.scale;

    const xs = shape.points.map((p) => p.x);
    const ys = shape.points.map((p) => p.y);

    const minX = Math.min(...xs) - padding;
    const minY = Math.min(...ys) - padding;
    const maxX = Math.max(...xs) + padding;
    const maxY = Math.max(...ys) + padding;

    return minX <= x && x <= maxX && minY <= y && y <= maxY;
  }

  private isPointOnText(x: number,y: number,shape: TextShape): boolean {
    return (shape.x <= x &&x <= shape.x + shape.width &&shape.y <= y &&y <= shape.y + shape.height);
  }

  private isOnResizeHandle(shape: Shape,x: number,y: number): "tl" | "tr" | "bl" | "br" | null {
    const { left, top, width, height } = this.getLeftTopWidthHeight(shape);

    const s = this.HANDLE_SIZE / this.scale;

    const handles = this.getHandles(left, top, width, height);

    for (const h of handles) {
      if (Math.abs(x - h.x) <= s && Math.abs(y - h.y) <= s) {
        return h.dir as "tl" | "tr" | "bl" | "br";
      }
    }

    return null;
  }

  private findShapeAtPoint(x: number, y: number) {
    for (let i = this.existingShapes.length - 1; i >= 0; i--) {
      const shape = this.existingShapes[i];
      const local = this.getLocalPoint(shape, x, y);

      switch (shape.type) {
        case "rect":
          if (this.isPointOnRect(local.x, local.y, shape)) return shape;
          break;

        case "diamond":
          if (this.isPointOnDiamond(local.x, local.y, shape)) return shape;
          break;

        case "ellipse":
          if (this.isPointOnEllipse(local.x, local.y, shape)) return shape;
          break;

        case "arrow":
          if (this.isPointOnArrow(local.x, local.y, shape)) return shape;
          break;

        case "line":
          if (this.isPointOnLine(local.x, local.y, shape)) return shape;
          break;

        case "pencil":
          if (this.isPointOnPencil(local.x, local.y, shape)) return shape;
          break;

        case "text":
          if (this.isPointOnText(local.x, local.y, shape)){
            this.canShowTextProperties?.(true);
            return shape;
          } 
          break;
      }
    }
  }

  private render = () => {
    const remoteLasers = [...this.remoteLaserPoints.values()].some(value => value.points.length > 0);

    if(this.selectedTool == "laser" || remoteLasers){
      this.clearCanvas();
      if(this.selectedTool == "laser")
        this.drawLaser();
    }
    else if (this.needsRender) {
      this.clearCanvas();
      this.needsRender = false;
    }
    this.animationFrameId = requestAnimationFrame(this.render);
  };

  private clearCanvas() {
    this.ctx.resetTransform();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "rgb(0,0,0)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.setTransform(this.scale,0,0,this.scale,this.offsetX * this.scale,this.offsetY * this.scale,);

    if (this.showGrid) this.drawGrid();

    this.sortByZIndex();

    const previewShapeIds = new Set([...this.previewshapes.values().map(s => s.id)]);

    this.existingShapes?.forEach((shape) => {
      if(shape.id === this.editingTextShapeId)return;
      if(previewShapeIds.has(shape.id))return;
      this.drawShape(shape);
    }
  );

    if (this.groupSelection) {
      this.drawGroupSelection();
    } else if (this.selectedShapeId) {
      const selectedShape = this.findShape(this.selectedShapeId);
      if (selectedShape) {
        this.drawSelectionBox(selectedShape);
      }
    }

    for (const [userId,pshape] of this.previewshapes) {
      if(userId == "self")continue;
      this.drawShape(pshape);
    }

    this.drawSelectionMarquee();

    for (const [userId, cursor] of this.cursors.entries()) {
      const remoteSelections = this.remoteSelections.get(userId);

      const remoteLaser = this.remoteLaserPoints.get(userId);

      if(remoteLaser)
        this.drawLaser(remoteLaser.points, remoteLaser.color);

      this.drawCursor(cursor, remoteSelections?.editing);

      if (!remoteSelections) continue;

      const selections = remoteSelections.shapeIds;

      if (selections.length == 1) {
        const shapeSelected = this.findShape(selections[0]);

        if (shapeSelected) {
          this.drawSelectionBox(shapeSelected, cursor.color);
        }
      } else if (selections.length > 1) {
        const bounds = this.getGroupBounds(new Set(selections));
        this.drawGroupSelection(bounds, cursor.color);
      }
    }
  }

  private normalizeRect(r: any) {
    return {
      x: Math.min(r.x, r.x + r.width),
      y: Math.min(r.y, r.y + r.height),
      width: Math.abs(r.width),
      height: Math.abs(r.height),
    };
  }

  private broadcastSelection(editing: boolean = false) {
    let shapeIds: string[] = [];

    if (this.selectedShapeId) shapeIds = [this.selectedShapeId];
    else if (this.groupSelection) shapeIds = [...this.groupSelection.shapeIds];

    if (this.socket.readyState == WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "selection:update",
          roomId: this.roomId,
          shapeIds,
          editing,
        }),
      );
    }
  }

  private drawGroupSelection(bounds?: SelectionBound,color: string = "#3b82f6",) {
    const b = bounds ?? this.groupSelection?.bounds;
    if (!b) return;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = this.strokeWidth / this.scale;
    this.ctx.strokeRect(
      b.x - this.SELECTION_PADDING,
      b.y - this.SELECTION_PADDING,
      b.width + 2 * this.SELECTION_PADDING,
      b.height + 2 * this.SELECTION_PADDING,
    );

    const handles = this.getHandles(b.x, b.y, b.width, b.height);
    //this.drawHandles(handles);//may-be in future
    this.ctx.restore();
  }

  private drawSelectionMarquee() {
    if (this.selectionRect) {
      this.ctx.save();

      this.ctx.fillStyle = "rgba(0,120,255,0.15)";
      this.ctx.strokeStyle = "#1687ff";
      this.ctx.lineWidth = 1 / this.scale;

      this.ctx.fillRect(
        this.selectionRect.x,
        this.selectionRect.y,
        this.selectionRect.width,
        this.selectionRect.height,
      );

      this.ctx.strokeRect(
        this.selectionRect.x,
        this.selectionRect.y,
        this.selectionRect.width,
        this.selectionRect.height,
      );

      const handles = this.getHandles(
        this.selectionRect.x,
        this.selectionRect.y,
        this.selectionRect.width,
        this.selectionRect.height,
      );

      for (const h of handles) {
        this.ctx.fillStyle = "#3b82f6";
      }

      this.ctx.restore();
    }
  }

  private drawLaserTrail(points: { x: number; y: number; time: number }[],color: string) {
    if (points.length < 2) return;

    const now = performance.now();

    const activePoints = points.filter((point) =>now - point.time < this.LASER_DURATION);

    points.length = 0;
    points.push(...activePoints);

    if (points.length < 2) return;

    this.ctx.save();

    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1];
      const current = points[i];

      const age = now - current.time;

      const progress = Math.max(0,Math.min(1,age / this.LASER_DURATION));

      const opacity = Math.pow(1 - progress,2);

      if (opacity <= 0) continue;

      const next = points[i + 1] ?? current;

      const midX = (current.x + next.x) * 0.5;

      const midY = (current.y + next.y) * 0.5;

      const width = (1.6 + 2.4 * Math.sqrt(opacity)) / this.scale;

      this.ctx.globalAlpha = opacity;
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = width;

      this.ctx.beginPath();

      this.ctx.moveTo(previous.x,previous.y);

      this.ctx.quadraticCurveTo(current.x,current.y,midX,midY);

      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawLaser(pts: {x: number, y: number, time: number}[] = this.laserPoints, color: string = this.strokeColor) {
    if (pts.length < 2)return;
    this.drawLaserTrail(pts,color);
  }

  private drawCursor(cursor: Cursor, editing: boolean = false) {
    this.ctx.save();

    this.ctx.translate(cursor.x, cursor.y);
    this.ctx.scale(this.scale, this.scale);

    this.ctx.beginPath();
    this.ctx.moveTo(0, 0); // tip
    this.ctx.lineTo(2, 18);
    this.ctx.lineTo(6, 12);
    this.ctx.lineTo(14, 13);
    this.ctx.closePath();

    this.ctx.fillStyle = cursor.color ?? "white";
    this.ctx.fill();

    this.ctx.strokeStyle = "black";
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    this.ctx.font = "12px sans-serif";
    this.ctx.fillStyle = cursor.color ?? "white";
    this.ctx.fillText(
      (cursor.name ?? "Guest") + (editing ? " is editing..." : ""),
      24,
      24,
    );

    this.ctx.restore();
  }

  private applyStyle(shape: Shape) {
    this.ctx.strokeStyle = shape.strokeColor;
    this.ctx.fillStyle = shape.fillColor;
    this.ctx.lineWidth = shape.strokeWidth / this.scale;

    switch (shape.strokeStyle) {
      case "solid":
        this.ctx.setLineDash([]);
        break;

      case "dashed":
        this.ctx.setLineDash([10, 5]);
        break;

      case "dotted":
        this.ctx.setLineDash([2, 4]);
        break;
    }

    this.ctx.globalAlpha = shape.opacity;
    //this.drawFillStyle(shape,shape.fillStyle);
  }

  // private drawFillStyle(shape:Shape,fillStyle:"solid" | "cross-hatch" | "hachure"){
  //   if(fillStyle == "hachure"){
  //     const pattern = this.ctx.createPattern(,"repeat");
  //     this.ctx.fillStyle = pattern!;
  //     this.ctx.fill();
  //   }
  // }

  private drawShape(shape: Shape | null) {
    if (!shape) return;
    this.ctx.save();
    this.applyStyle(shape);

    const b = this.getShapeBounds(shape);

    if (b && shape.rotation) {
      this.ctx.translate((b.left + b.right) / 2, (b.top + b.bottom) / 2);
      this.ctx.rotate(shape.rotation);
      this.ctx.translate(-(b.left + b.right) / 2, -(b.top + b.bottom) / 2);
    }

    if (shape.type === "rect") {
      if (shape.fillColor !== "transparent")
        this.ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
      this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === "ellipse") {
      this.ctx.beginPath();
      this.ctx.ellipse(
        shape.centerX,
        shape.centerY,
        shape.radX,
        shape.radY,
        0,
        0,
        Math.PI * 2,
      );
      if (shape.fillColor !== "transparent") this.ctx.fill();
      this.ctx.stroke();
    } else if (shape.type === "diamond") {
      const topPoint = { x: shape.centerX, y: shape.top };
      const rightPoint = { x: shape.left + shape.width, y: shape.centerY };
      const bottomPoint = { x: shape.centerX, y: shape.top + shape.height };
      const leftPoint = { x: shape.left, y: shape.centerY };

      this.ctx.beginPath();
      this.ctx.moveTo(topPoint.x, topPoint.y);
      this.ctx.lineTo(rightPoint.x, rightPoint.y);
      this.ctx.lineTo(bottomPoint.x, bottomPoint.y);
      this.ctx.lineTo(leftPoint.x, leftPoint.y);
      this.ctx.closePath();
      if (shape.fillColor !== "transparent") this.ctx.fill();
      this.ctx.stroke();
    } else if (shape.type == "line") {
      this.ctx.beginPath();
      this.ctx.moveTo(shape.sX, shape.sY);
      this.ctx.lineTo(shape.eX, shape.eY);
      this.ctx.stroke();
      this.ctx.closePath();
    } else if (shape.type == "pencil") {
      this.ctx.beginPath();
      if (!shape.points || shape.points.length === 0) return;
      this.ctx.moveTo(shape.points[0].x, shape.points[0].y);

      for (let p of shape.points) {
        this.ctx.lineTo(p.x, p.y);
      }
      this.ctx.stroke();
    } else if (shape.type === "arrow") {
      const headLength = 12;

      const angle = Math.atan2(shape.eY - shape.sY, shape.eX - shape.sX);

      this.ctx.beginPath();

      this.ctx.moveTo(shape.sX, shape.sY);
      this.ctx.lineTo(shape.eX, shape.eY);

      this.ctx.lineTo(
        shape.eX - headLength * Math.cos(angle - Math.PI / 6),
        shape.eY - headLength * Math.sin(angle - Math.PI / 6),
      );

      this.ctx.moveTo(shape.eX, shape.eY);

      this.ctx.lineTo(
        shape.eX - headLength * Math.cos(angle + Math.PI / 6),
        shape.eY - headLength * Math.sin(angle + Math.PI / 6),
      );

      this.ctx.stroke();
    } else if (shape.type == "text") {
      const family = shape.fontFamily == "serif" ? "serif" : shape.fontFamily == "mono" ? "monospace" : "sans-serif";

      this.ctx.font = `${shape.fontStyle} ${shape.fontWeight} ${shape.fontSize}px ${family}`;

      this.ctx.fillStyle = shape.strokeColor;
      this.ctx.textBaseline = "top";
      this.ctx.textAlign = shape.textAlign;

      const lines = this.getWrappedTextLines(shape);
      const lineHeight = shape.fontSize * 1.2;

      let textX = shape.x;

      if (shape.textAlign == "center") {
        textX = shape.x + shape.width / 2;
      } else if (shape.textAlign == "right") {
        textX = shape.x + shape.width;
      }

      lines.forEach((line, idx) => {
        this.ctx.fillText(line, textX, shape.y + idx * lineHeight);
      });
    }
    this.ctx.restore();
  }

  updateSelectedShape(updates: Partial<Shape>) {
    if (this.selectedShapeId) {
      const idx = this.findShapeIndex(this.selectedShapeId);
      if (idx == -1) return;
      const before = structuredClone(this.existingShapes[idx]);
      //@ts-ignore
      this.existingShapes[idx] = { ...this.existingShapes[idx], ...updates };

      this.undoStack.push({
        type: "update",
        before: before,
        after: structuredClone(this.existingShapes[idx]),
      });

      this.redoStack = [];
      this.needsRender = true;

      this.socket.send(
        JSON.stringify({
          type: "shape:update",
          roomId: this.roomId,
          shape: this.existingShapes[idx],
        }),
      );
    } else if (this.groupSelection) {
      const before = [...this.groupSelection.shapeIds].map(
        (id) => structuredClone(this.findShape(id))!,
      );
      const after: Shape[] = [];

      for (const shapeId of this.groupSelection.shapeIds) {
        const idx = this.findShapeIndex(shapeId);
        if (idx == -1) continue;
        //@ts-ignore
        this.existingShapes[idx] = { ...this.existingShapes[idx], ...updates };
        after.push(structuredClone(this.existingShapes[idx]));
      }

      this.undoStack.push({
        type: "group-update",
        before: before,
        after: after,
      });
      this.redoStack = [];
      this.needsRender = true;

      this.socket.send(
        JSON.stringify({
          type: "shapes:update",
          roomId: this.roomId,
          shapes: after,
        }),
      );
    }
  }

  private getLocalPoint(shape: Shape, x: number, y: number) {
    if (!shape.rotation) return { x, y };

    const bounds = this.getShapeBounds(shape);

    const cx = (bounds.left + bounds.right) / 2;
    const cy = (bounds.top + bounds.bottom) / 2;

    const dx = x - cx;
    const dy = y - cy;

    const cos = Math.cos(-shape.rotation);
    const sin = Math.sin(-shape.rotation);

    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  }

  private addShape(shape: Shape) {
    if (this.existingShapes.find((s) => s.id == shape.id)) return;
    this.existingShapes.push(shape);
    this.sortByZIndex();
    this.needsRender = true;
  }

  private findShapeIndex(shapeId: string): number {
    const idx = this.existingShapes.findIndex((shape) => shape.id === shapeId);
    return idx;
  }

  private findShape(shapeId: string): Shape | undefined {
    return this.existingShapes.find((shape) => shape.id === shapeId);
  }

  private updateShape(shapeId: string, updatedShape: Partial<Shape>) {
    const idx = this.existingShapes.findIndex((shape) => shape.id == shapeId);
    if (idx == -1) return;

    this.existingShapes[idx] = {
      ...this.existingShapes[idx],
      ...updatedShape,
    } as Shape;
    this.needsRender = true;
  }

  private deleteShape(shapeId: string) {
    const idx = this.existingShapes.findIndex((shape) => shape.id == shapeId);
    if (idx == -1) return;

    this.existingShapes.splice(idx, 1);
    this.needsRender = true;
  }

  private dblClickHandler = (e: MouseEvent) => {
    if (this.selectedTool !== "select") return;

    const { x, y } = this.getMousePos(e);
    const shape = this.findShapeAtPoint(x, y);
    if (!shape || shape.type !== "text") return;

    this.interaction = "idle";
    this.currentShape = null;
    this.selectionRect = null;
    this.resizeHandle = null;
    this.selectedShapeId = shape.id;
    this.groupSelection = null;
    this.needsRender = true;

    this.editTextShape(shape);
  };

  initHandlers() {
    this.socket.onmessage = (e) => {
      const received = JSON.parse(e.data);
      switch (received.type) {
        case "room_snapshot":
          console.log("ROOM SNAPSHOT RECEIVED:", received);
          console.log("IS OWNER FROM SERVER:", received.isOwner);
          this.existingShapes = received.shapes;
          this.sortByZIndex();
          this.isOwnerListener?.(received.isOwner);
          this.needsRender = true;
          break;
        case "user:joined":
          this.cursors.set(received.userId, {
            x: 0,
            y: 0,
            name: received.name,
            color: received.color,
          });
          if (!this.users.find((u) => u.id === received.userId)) {
            this.users.push({
              id: received.userId,
              name: received.name,
              color: received.color,
              you: false,
            });
          }
          this.usersListener?.([...this.users]);
          this.onlineUsers?.(this.users.length);
          this.toastListener?.({
            message: `${received.name} joined`,
            color: received.color,
          });
          this.needsRender = true;
          break;
        case "user:left":
          this.cursors.delete(received.userId);
          this.remoteSelections.delete(received.userId);
          this.remoteLaserPoints.delete(received.userId);
          this.users = this.users.filter((u) => u.id !== received.userId);
          this.usersListener?.([...this.users]);
          this.onlineUsers?.(this.users.length);
          this.toastListener?.({
            message: `${received.name} left`,
            color: received.color,
          });
          this.needsRender = true;
          break;
        case "cursor:update":
          const existingCursor = this.cursors.get(received.userId);
          if (existingCursor) {
            ((existingCursor.x = received.x), (existingCursor.y = received.y));
          }

          if(received.laser){
            let remoteLaser = this.remoteLaserPoints.get(received.userId);

            if(!remoteLaser){
              remoteLaser = {
                points: [],
                color: received.laserColor ?? "#ff0000"
              }
              this.remoteLaserPoints.set(received.userId,remoteLaser);
            }

            if(received.laserColor){
              remoteLaser.color = received.laserColor;
            }

            const now = performance.now();
            const pts = remoteLaser.points;
            const last = pts[pts.length - 1];

            if(!last || Math.hypot(received.x - last.x,received.y - last.y) >= this.LASER_MIN_DISTANCE){
              pts.push({x: received.x, y: received.y, time: now});
            }

            if(pts.length > this.LASER_MAX_POINTS){
              pts.splice(0,pts.length - this.LASER_MAX_POINTS);
            }
          }

          this.needsRender = true;
          break;
        case "selection:update":
          if (received.shapeIds && received.shapeIds.length) {
            this.remoteSelections.set(received.userId, {
              shapeIds: received.shapeIds,
              editing: received.editing,
            });
          } else {
            this.remoteSelections.delete(received.userId);
          }
          this.needsRender = true;
          break;
        case "shape:preview":
          this.previewshapes.set(received.userId, received.shape);
          this.needsRender = true;
          break;
        case "shape:add":
          this.previewshapes.delete(received.userId);
          this.addShape(received.shape);
          break;
        case "shapes:add":
          this.previewshapes.delete(received.userId);
          for (const shape of received.shapes) {
            this.addShape(shape);
          }
          break;
        case "shape:update":
          this.previewshapes.delete(received.userId);
          this.updateShape(received.shape.id, received.shape);
          break;
        case "shapes:update":
          this.previewshapes.delete(received.userId);
          for (const shape of received.shapes) {
            this.updateShape(shape.id, shape);
          }
          break;
        case "shape:delete":
          this.deleteShape(received.shape.id);
          break;
        case "shapes:delete":
          for (const id of received.shapeIds) {
            this.deleteShape(id);
          }
          break;
        case "layer:update":
          this.existingShapes = received.shapes;
          this.sortByZIndex();
          this.needsRender = true;
          break;
      }
    };
  }

  initMouseHandlers() {
    this.canvas.addEventListener("mousedown", this.mouseDownHandler);
    window.addEventListener("mouseup", this.mouseUpHandler);
    window.addEventListener("mousemove", this.mouseMoveHandler);
    this.canvas.addEventListener("dblclick", this.dblClickHandler);
  }

  initKeyboardhandlers() {
    window.addEventListener("keydown", this.keyDownHandler);
  }

  private keyDownHandler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      return;

    if (e.ctrlKey && !e.shiftKey && e.key == "z") {
      e.preventDefault();
      this.undo();
      return;
    }
    //console.log(e.ctrlKey+" "+e.shiftKey+" "+e.key);//Z
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() == "z") {
      e.preventDefault();
      this.redo();
      return;
    }

    if (e.key == "Escape") {
      e.preventDefault();
      this.shapeSelection(null);
      return;
    }

    if (e.ctrlKey && e.key == "c") {
      e.preventDefault();
      this.copySelectedShape();
      return;
    }

    if (e.ctrlKey && e.key == "v") {
      e.preventDefault();
      this.pasteSelectedShape();
      return;
    }

    if (e.ctrlKey && e.key == "d") {
      e.preventDefault();
      this.duplicateShape();
      return;
    }

    if (e.key == "Delete") {
      e.preventDefault();
      this.deleteSelectedShape();
      return;
    }

    switch (e.key.toLowerCase()) {
      case "r":
        this.setSelectedTool("rect");
        break;

      case "e":
        this.setSelectedTool("ellipse");
        break;

      case "d":
        this.setSelectedTool("diamond");
        break;

      case "l":
        this.setSelectedTool("line");
        break;

      case "a":
        this.setSelectedTool("arrow");
        break;

      case "p":
        this.setSelectedTool("pencil");
        break;

      case "v":
        this.setSelectedTool("select");
        break;

      case "h":
        this.setSelectedTool("hand");
        break;

      case "t":
        this.setSelectedTool("text");
        break;

      case "z":
        this.setSelectedTool("laser");
        break;
    }
  };

  destroy() {
    if (this.animationFrameId !== null)
      cancelAnimationFrame(this.animationFrameId);
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
    window.removeEventListener("mouseup", this.mouseUpHandler);
    window.removeEventListener("mousemove", this.mouseMoveHandler);
    window.removeEventListener("keydown", this.keyDownHandler);
    this.canvas.removeEventListener("dblclick", this.dblClickHandler);
    this.removeTextEditor();
  }

  private getNextZIndex(): number {
    if (this.existingShapes.length == 0) return 0;
    return Math.max(...this.existingShapes.map((s) => s.zIndex)) + 1;
  }

  private reassignZIndex() {
    this.existingShapes.forEach((shape, idx) => (shape.zIndex = idx));
  }

  private sortByZIndex() {
    this.existingShapes.sort((a: Shape, b: Shape) => a.zIndex - b.zIndex);
  }

  bringForward() {
    const idx = this.selectedShapeId
      ? this.findShapeIndex(this.selectedShapeId)
      : -1;
    if (idx == -1 || idx == this.existingShapes.length - 1) return;
    const before = structuredClone(this.existingShapes);
    [this.existingShapes[idx], this.existingShapes[idx + 1]] = [
      this.existingShapes[idx + 1],
      this.existingShapes[idx],
    ];
    this.reassignZIndex();
    this.afterLayerOperation(before);
  }

  sendBackward() {
    const idx = this.selectedShapeId
      ? this.findShapeIndex(this.selectedShapeId)
      : -1;
    if (idx <= 0) return;
    const before = structuredClone(this.existingShapes);
    [this.existingShapes[idx], this.existingShapes[idx - 1]] = [
      this.existingShapes[idx - 1],
      this.existingShapes[idx],
    ];
    this.reassignZIndex();
    this.afterLayerOperation(before);
  }

  bringToFront() {
    const idx = this.selectedShapeId
      ? this.findShapeIndex(this.selectedShapeId)
      : -1;
    if (idx == -1) return;
    const before = structuredClone(this.existingShapes);
    const shape = this.existingShapes.splice(idx, 1)[0];
    this.existingShapes.push(shape);
    this.reassignZIndex();
    this.afterLayerOperation(before);
  }

  sendToBack() {
    const idx = this.selectedShapeId
      ? this.findShapeIndex(this.selectedShapeId)
      : -1;
    if (idx == -1) return;
    const before = structuredClone(this.existingShapes);
    const shape = this.existingShapes.splice(idx, 1)[0];
    this.existingShapes.unshift(shape);
    this.reassignZIndex();
    this.afterLayerOperation(before);
  }

  private afterLayerOperation(before: Shape[]) {
    this.undoStack.push({
      type: "layer",
      before: structuredClone(before),
      after: structuredClone(this.existingShapes),
    });
    this.redoStack = [];
    this.needsRender = true;
    if (this.socket.readyState == WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "layer:update",
          roomId: this.roomId,
          shapes: this.existingShapes,
        }),
      );
    } else {
      console.log("socket closed h");
    }
  }

  undo() {
    if (this.undoStack.length == 0) return;

    const lastAction = this.undoStack.pop();
    if (!lastAction) return;

    if (lastAction.type == "add") {
      this.deleteShape(lastAction.shape.id);
    } else if (lastAction.type == "delete") {
      this.addShape(lastAction.shape);
    } else if (lastAction.type === "update") {
      this.updateShape(lastAction.before.id, lastAction.before);
    } else if (lastAction.type === "group-add") {
      for (const shape of lastAction.shapes) this.deleteShape(shape.id);
    } else if (lastAction.type === "group-delete") {
      for (const shape of lastAction.shapes) {
        this.addShape(structuredClone(shape));
      }
    } else if (lastAction.type === "group-update") {
      for (const shape of lastAction.before) {
        this.updateShape(shape.id, structuredClone(shape));
      }
    } else if (lastAction.type === "layer") {
      this.existingShapes = structuredClone(lastAction.before);
      this.sortByZIndex();
    }

    if (this.groupSelection) {
      this.groupSelection.bounds = this.getGroupBounds(
        this.groupSelection.shapeIds,
      );
    }

    this.needsRender = true;

    if (this.socket.readyState == WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "history:undo",
          roomId: this.roomId,
          action: lastAction,
        }),
      );
    }

    this.redoStack.push(structuredClone(lastAction));
  }

  redo() {
    if (this.redoStack.length === 0) return;

    const lastAction = this.redoStack.pop();
    if (!lastAction) return;

    if (lastAction.type == "add") {
      this.addShape(lastAction.shape);
    } else if (lastAction.type == "delete") {
      this.deleteShape(lastAction.shape.id);
    } else if (lastAction.type == "update") {
      this.updateShape(lastAction.before.id, lastAction.after);
    } else if (lastAction.type === "group-add") {
      for (const shape of lastAction.shapes)
        this.addShape(structuredClone(shape));
    } else if (lastAction.type === "group-delete") {
      for (const shape of lastAction.shapes) {
        this.deleteShape(shape.id);
      }
    } else if (lastAction.type === "group-update") {
      for (const shape of lastAction.after) {
        this.updateShape(shape.id, structuredClone(shape));
      }
    } else if (lastAction.type === "layer") {
      this.existingShapes = structuredClone(lastAction.after);
      this.sortByZIndex();
    }

    if (this.groupSelection) {
      this.groupSelection.bounds = this.getGroupBounds(
        this.groupSelection.shapeIds,
      );
    }

    this.needsRender = true;

    if (this.socket.readyState == WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "history:redo",
          roomId: this.roomId,
          action: lastAction,
        }),
      );
    }

    this.undoStack.push(structuredClone(lastAction));
  }

  private moveSelectedShape(shape: Shape, dx: number, dy: number) {
    switch (shape.type) {
      case "rect":
        shape.x += dx;
        shape.y += dy;
        break;

      case "diamond":
        shape.left += dx;
        shape.top += dy;
        shape.centerX += dx;
        shape.centerY += dy;
        break;

      case "ellipse":
        shape.centerX += dx;
        shape.centerY += dy;
        break;

      case "line":
      case "arrow":
        shape.sX += dx;
        shape.sY += dy;
        shape.eX += dx;
        shape.eY += dy;
        break;

      case "pencil":
        shape.points.forEach((p) => {
          p.x += dx;
          p.y += dy;
        });
        break;

      case "text":
        shape.x += dx;
        shape.y += dy;
        break;
    }
    this.needsRender = true;
  }

  copySelectedShape() {
    this.clipboardShape = null;
    this.clipboardShapes = null;

    if (this.selectedShapeId) {
      const shape = this.findShape(this.selectedShapeId);
      if (!shape) return;

      this.clipboardShape = structuredClone(shape);
    }

    if (this.groupSelection) {
      this.clipboardShapes = [...this.groupSelection.shapeIds].map(
        (id) => structuredClone(this.findShape(id))!,
      );
    }
  }

  pasteSelectedShape() {
    if (this.clipboardShape) {
      const newShape = structuredClone(this.clipboardShape);
      newShape.id = crypto.randomUUID();
      newShape.zIndex = this.getNextZIndex();

      this.moveSelectedShape(newShape, 30, 30);
      if (this.socket.readyState == WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "shape:add",
            roomId: this.roomId,
            shape: newShape,
          }),
        );
      }
      this.addShape(newShape);

      this.undoStack.push({
        type: "add",
        shape: structuredClone(newShape),
      });
      this.redoStack = [];

      this.selectedShapeId = newShape.id;
    }

    if (this.clipboardShapes) {
      const newShapes: Shape[] = [];
      let nextZ = this.getNextZIndex();

      for (const shape of this.clipboardShapes) {
        const copy = structuredClone(shape);
        copy.id = crypto.randomUUID();
        copy.zIndex = nextZ++;

        this.moveSelectedShape(copy, 30, 30);
        this.addShape(copy);

        newShapes.push(copy);
      }

      this.undoStack.push({
        type: "group-add",
        shapes: structuredClone(newShapes),
      });
      this.redoStack = [];

      if (this.socket.readyState == WebSocket.OPEN && newShapes.length) {
        this.socket.send(
          JSON.stringify({
            type: "shapes:add",
            roomId: this.roomId,
            shapes: newShapes,
          }),
        );
      }

      this.groupSelection = null;
    }
  }

  duplicateShape() {
    if (this.selectedShapeId || this.groupSelection) {
      this.copySelectedShape();
      this.pasteSelectedShape();
    }
  }

  deleteSelectedShape() {
    if (this.selectedShapeId) {
      const shapeToBeDeleted = this.findShape(this.selectedShapeId);

      this.deleteShape(this.selectedShapeId);

      if (this.socket.readyState == WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "shape:delete",
            roomId: this.roomId,
            shape: { id: this.selectedShapeId },
          }),
        );
      }

      this.undoStack.push({
        type: "delete",
        shape: structuredClone(shapeToBeDeleted)!,
      });
      this.redoStack = [];

      this.selectedShapeId = null;
      this.canShowTextProperties?.(false);
      this.shapeSelection(null);
    }

    if (this.groupSelection) {
      const deletedShapes = [...this.groupSelection.shapeIds]
        .map((id) => this.findShape(id))
        .filter((shape) => shape !== undefined)
        .map((shape) => structuredClone(shape));

      for (const shape of deletedShapes) {
        this.deleteShape(shape.id);
      }

      this.undoStack.push({
        type: "group-delete",
        shapes: deletedShapes,
      });
      this.redoStack = [];

      if (this.socket.readyState == WebSocket.OPEN && deletedShapes.length) {
        this.socket.send(
          JSON.stringify({
            type: "shapes:delete",
            roomId: this.roomId,
            shapeIds: deletedShapes.map((s) => s.id),
          }),
        );
      }

      this.groupSelection = null;
      this.groupSelected();
    }
  }

  private shapeIntersectsSelectionRect(shape: Shape, r: any) {
    let box: any;

    switch (shape.type) {
      case "rect":
      case "diamond":
        box = {
          x: "x" in shape ? shape.x : shape.left,
          y: "y" in shape ? shape.y : shape.top,
          width: shape.width,
          height: shape.height,
        };

        break;

      case "ellipse":
        box = {
          x: shape.centerX - shape.radX,
          y: shape.centerY - shape.radY,
          width: shape.radX * 2,
          height: shape.radY * 2,
        };

        break;

      case "line":
      case "arrow":
        box = {
          x: Math.min(shape.eX, shape.sX),
          y: Math.min(shape.eY, shape.sY),
          width: Math.abs(shape.eX - shape.sX),
          height: Math.abs(shape.eY - shape.sY),
        };

        break;

      case "pencil":
        const xs = shape.points.map((p) => p.x);
        const ys = shape.points.map((p) => p.y);

        box = {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        };

        break;

      case "text":
        box = {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
        };
        break;
    }

    return (
      r.x <= box.x &&
      box.x + box.width <= r.x + r.width &&
      r.y <= box.y &&
      box.y + box.height <= r.y + r.height
    );
  }

  private getShapeBounds(shape: Shape) {
    switch (shape.type) {
      case "rect":
        return {
          left: shape.x,
          top: shape.y,
          right: shape.x + shape.width,
          bottom: shape.y + shape.height,
        };

      case "ellipse":
        return {
          left: shape.centerX - shape.radX,
          top: shape.centerY - shape.radY,
          right: shape.centerX + shape.radX,
          bottom: shape.centerY + shape.radY,
        };

      case "diamond":
        return {
          left: shape.left,
          top: shape.top,
          right: shape.left + shape.width,
          bottom: shape.top + shape.height,
        };

      case "line":
      case "arrow":
        return {
          left: Math.min(shape.sX, shape.eX),
          top: Math.min(shape.sY, shape.eY),
          right: Math.max(shape.sX, shape.eX),
          bottom: Math.max(shape.sY, shape.eY),
        };

      case "pencil": {
        const xs = shape.points.map((p) => p.x);
        const ys = shape.points.map((p) => p.y);

        return {
          left: Math.min(...xs),
          top: Math.min(...ys),
          right: Math.max(...xs),
          bottom: Math.max(...ys),
        };
      }

      case "text": {
        return {
          left: shape.x,
          top: shape.y,
          right: shape.x + shape.width,
          bottom: shape.y + shape.height,
        };
      }
    }
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }

  private getGroupBounds(ids: Set<string>) {
    let left = Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    let right = -Infinity;

    for (const id of ids) {
      const shape = this.findShape(id);
      if (!shape) continue;
      const b = this.getShapeBounds(shape)!;

      left = Math.min(left, b.left);
      top = Math.min(top, b.top);
      right = Math.max(right, b.right);
      bottom = Math.max(bottom, b.bottom);
    }

    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  private pointsInsideBounds(x: number, y: number, b: SelectionBound) {
    return b.x <= x && x <= b.x + b.width && b.y <= y && y <= b.y + b.height;
  }

  private createTextEditor(endX: number,endY: number,shape?: TextShape) {
    if (this.textEditor) {
      this.removeTextEditor();
    }

    const textarea = document.createElement("textarea");
    textarea.wrap = "off";
    textarea.value = shape ? shape.text : "";

    const rect = this.canvas.getBoundingClientRect();

    textarea.style.position = "absolute";
    textarea.style.left = `${rect.left + window.scrollX + (endX + this.offsetX) * this.scale}px`;
    textarea.style.top = `${rect.top + window.scrollY + (endY + this.offsetY) * this.scale}px`;

    textarea.style.width = `${Math.max((shape?.width ?? 200) * this.scale, 100)}px`;
    textarea.style.height = `${Math.max((shape?.height ?? 40) * this.scale, 30)}px`;

    textarea.style.background = "transparent";
    textarea.style.color = shape?.strokeColor ?? this.strokeColor;
    textarea.style.outline = "1px dashed #3b82f6";
    textarea.style.border = "none";
    textarea.style.resize = "none";

    textarea.style.whiteSpace = "pre";
    textarea.style.overflowWrap = "normal";
    textarea.style.wordBreak = "normal";
    textarea.style.overflowX = "hidden";
    textarea.style.overflowY = "hidden";
    textarea.style.boxSizing = "border-box";

    textarea.style.cursor = shape?.strokeColor ?? this.strokeColor;

    textarea.style.fontSize = `${(shape?.fontSize ?? this.fontSize) * this.scale}px`;
    textarea.style.fontStyle = shape?.fontStyle ?? "normal";
    textarea.style.fontWeight = shape?.fontWeight ?? "normal";
    textarea.style.textAlign = shape?.textAlign ?? "left";
    textarea.style.fontFamily = shape?.fontFamily === "serif"? "serif": shape?.fontFamily === "mono"? "monospace": shape?.fontFamily === "sans"? "sans-serif": this.fontFamily === "serif"? "serif": this.fontFamily === "mono"? "monospace": "sans-serif";

    textarea.style.lineHeight = "1.2";
    textarea.style.padding = "0";
    textarea.style.zIndex = this.getNextZIndex().toString();

    document.body.appendChild(textarea);

    this.textEditor = textarea;

    this.updateTextEditorSize();

    requestAnimationFrame(() => {
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);

      textarea.focus();
    });

    textarea.addEventListener("input", () => {
      this.handleTextEditorInput();
    });

    textarea.addEventListener("keydown", (e) => {
      if (e.key == "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.finishTextEditing();
      }

      if (e.key == "Escape") {
        e.preventDefault();
        this.cancelTextEditing();
      }
    });

    // console.log("4 before outside listener");

    // this.textEditorOutsideClickHandler = (e: MouseEvent) => {
    //   if (!this.textEditor) return;

    //   console.log("clicking outside of the textbox",".......",e.target);

    //   if (e.target === this.textEditor) return;

    //   this.finishTextEditing();
    // };

    // document.addEventListener("mousedown",this.textEditorOutsideClickHandler);

    // console.log("5 outside listener added");
  }

  private updateTextEditorSize(){
    if(!this.textEditor)return;

    const textarea = this.textEditor;

    textarea.style.width = "1px";

    textarea.style.width = `${Math.max(textarea.scrollWidth,20*this.scale)}px`;
    textarea.style.height = `${Math.max(textarea.scrollHeight,20*this.scale)}px`;
  }

  private handleTextEditorInput() {
    if (!this.textEditor) return;

    const textarea = this.textEditor;
    const text = this.textEditor.value;

    let previewShape: TextShape;

    if (this.editingTextShapeId) {
      const original = this.findShape(this.editingTextShapeId);

      if (!original || original.type !== "text") return;

      previewShape = structuredClone(original);

      previewShape.text = text;

      previewShape.fontSize = this.fontSize;
      previewShape.fontFamily = this.fontFamily;
      previewShape.fontWeight = this.fontWeight;
      previewShape.fontStyle = this.fontStyle;
      previewShape.textAlign = this.textAlign;
      previewShape.strokeColor = this.strokeColor;

      if(previewShape.textAutoResize !== false){
      const bounds = this.getTextBound(previewShape);

      previewShape.width = bounds.width;
      previewShape.height = bounds.height;

      textarea.style.width = `${Math.max(bounds.width * this.scale + 4, 20 *this.scale)}px`;
      textarea.style.height = `${Math.max(bounds.height * this.scale + 4, 20 * this.scale)}px`;

      }else{

      previewShape.height = this.getWrappedTextHeight(previewShape);

      textarea.style.width = `${Math.max(previewShape.width * this.scale + 4, 20 *this.scale)}px`;
      textarea.style.height = `${Math.max(previewShape.height * this.scale + 4, 20 * this.scale)}px`;

      }

    } else {

      if(!this.textPreviewShapeId){
        this.textPreviewShapeId = crypto.randomUUID();
      }

      previewShape = {
        id: this.textPreviewShapeId,
        type: "text",

        x: this.textEditorX,
        y: this.textEditorY,

        width: Math.max(20, this.textEditor.scrollWidth / this.scale),
        height: Math.max(20, this.textEditor.scrollHeight / this.scale),

        text,

        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
        fontWeight: this.fontWeight,
        fontStyle: this.fontStyle,
        textAlign: this.textAlign,

        ...this.getCurrentStyling(),
      };

      const bounds = this.getTextBound(previewShape);

      previewShape.width = bounds.width;
      previewShape.height = bounds.height;

      textarea.style.width = `${Math.max(bounds.width * this.scale + 4, 20 * this.scale)}px`;

      textarea.style.height = `${Math.max(bounds.height * this.scale + 4, 30)}px`;

      this.textPreviewShapeId = previewShape.id;
    }

    this.previewshapes.set("self",previewShape);
    this.needsRender = true;

    const now = performance.now();

    if(now - this.lastPreviewSent >= this.PREVIEW_INTERVAL && this.socket.readyState == WebSocket.OPEN){
      this.lastPreviewSent = now;

      this.socket.send(JSON.stringify({
        type:"shape:preview",
        roomId: this.roomId ,
        shape: previewShape
      }));
    }
  }

  private editTextShape(shape: TextShape) {
    this.editingTextShapeId = shape.id;

    this.fontSize = shape.fontSize;
    this.fontFamily = shape.fontFamily;
    this.fontWeight = shape.fontWeight;
    this.fontStyle = shape.fontStyle;
    this.textAlign = shape.textAlign;
    this.strokeColor = shape.strokeColor;

    this.selectedShapeId = shape.id;
    this.groupSelection = null;
    this.selectionRect = null;
    this.groupSelection = null;

    this.createTextEditor(shape.x, shape.y, shape);
    this.broadcastSelection(true);

    this.needsRender = true;
  }

  finishTextEditing() {
    if (!this.textEditor) return;

    const textarea = this.textEditor;
    const text = textarea.value;

    if (!text.trim()) {

      if(this.editingTextShapeId){
        const idx = this.existingShapes.findIndex(s => s.id === this.editingTextShapeId);
        if(idx != -1){
          const deletedShape = structuredClone(this.existingShapes[idx]);
          this.existingShapes.splice(idx,1);

          this.undoStack.push({
            type:"delete",
            shape:deletedShape
          });
          this.redoStack = [];

          if(this.socket.readyState == WebSocket.OPEN){
            this.socket.send(JSON.stringify({
              type:"shape:delete",
              roomId: this.roomId,
              shapeId: deletedShape.id
            }));
          }
        }
      }

      this.previewshapes.delete("self");
      this.textPreviewShapeId = null;
      this.removeTextEditor();
      this.needsRender = true;
      return;
    }

    this.handleTextEditorInput();

    const preview = this.previewshapes.get("self");
    if(!preview || preview.type !== "text"){
      this.removeTextEditor();
      return;
    }

    if (this.socket.readyState === WebSocket.OPEN) {
      this.lastPreviewSent = performance.now();

      this.socket.send(JSON.stringify({
        type: "shape:preview",
        roomId: this.roomId,
        shape: preview,
      }));
    }

    if (this.editingTextShapeId) {
      const shape = this.findShape(this.editingTextShapeId);

      if (shape && shape.type == "text") {
        const before = structuredClone(shape);

        Object.assign(shape,structuredClone(preview));

        this.undoStack.push({
          type: "update",
          before: before,
          after: structuredClone(shape),
        });

        this.redoStack = [];

        if (this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(
            JSON.stringify({
              type: "shape:update",
              roomId: this.roomId,
              shape,
            }),
          );
        }
      }
    }
    else{
      const shape = structuredClone(preview);

      this.addShape(shape);

      this.undoStack.push({
        type: "add",
        shape: structuredClone(shape),
      });

      this.redoStack = [];

      if (this.socket.readyState == WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "shape:add",
            roomId: this.roomId,
            shape,
          }),
        );
      }
    }

    this.previewshapes.delete("self");
    this.textPreviewShapeId = null;
    this.removeTextEditor();
    this.broadcastSelection(false);
    this.needsRender = true;
  }

  private getTextBound(shape: TextShape){
    const family = shape.fontFamily === "serif"? "serif": shape.fontFamily === "mono"? "monospace" : "sans-serif";

    this.ctx.save();

    this.ctx.font = `${shape.fontStyle} ${shape.fontWeight} ${shape.fontSize}px ${family}`;

    const lines = shape.text.split("\n");
    const lineHeight = shape.fontSize * 1.2;

    let maxWidth = 0;

    for (const line of lines) {
      const width = this.ctx.measureText(line || " ").width;
      maxWidth = Math.max(maxWidth, width);
    }

    this.ctx.restore();

    return {
      width: Math.max(20, maxWidth),
      height: Math.max(lineHeight, lines.length * lineHeight),
    };
  }

  private getWrappedTextLines(shape: TextShape):string[]{
     const family = shape.fontFamily === "serif" ? "serif" : shape.fontFamily === "mono" ? "monospace" : "sans-serif";

     this.ctx.save();
     this.ctx.font = `${shape.fontStyle} ${shape.fontWeight} ${shape.fontSize}px ${family}`;

     const result: string[] = [];

     const paragraphs = shape.text.split("\n");

     for(const paragraph of paragraphs){
      if(paragraph.length == 0){
        result.push("");
        continue;
      }

      const words = paragraph.split(" ");

      let line = "";

      for(const word of words){
        const testline = line.length > 0 ? `${line} ${word}` : `${word}`;

        const width = this.ctx.measureText(testline).width;

        if(width > shape.width && line.length > 0){
          result.push(line);
          line = word;
        }
        else {
          line = testline;
        }
      }

      result.push(line);
     }

     this.ctx.restore();
     return result;
  }

  private getWrappedTextHeight(shape: TextShape):number{
    const lines = this.getWrappedTextLines(shape);

    const lineHeight = shape.fontSize * 1.2;

    return Math.max(lineHeight,lines.length * lineHeight);
  }

  private removeTextEditor() {
    if(this.textEditorOutsideClickHandler){
      document.removeEventListener("mousedown",this.textEditorOutsideClickHandler);
      this.textEditorOutsideClickHandler = null;
    }
    if (this.textEditor) {
      this.textEditor.remove();
    }
    this.textEditor = null;
    this.editingTextShapeId = null;
    this.textPreviewShapeId = null;
  }

  private cancelTextEditing() {
    this.broadcastSelection();
    this.previewshapes.delete("self");
    this.removeTextEditor();
    this.needsRender = true;
  }

  mouseDownHandler = (e: MouseEvent) => {
    if(this.textEditor){
      if(e.target == this.canvas){
        this.finishTextEditing();
      }
      return;
    }
    if (this.selectedTool === "hand") {
      this.isPanning = true;
      this.canvas.style.cursor = "grabbing";

      this.panX = e.clientX;
      this.panY = e.clientY;
      return;
    }

    let { x, y } = this.getMousePos(e);

    if (this.selectedTool === "laser") {
      this.isLaserDrawing = true;

      this.laserPoints = [{x,y,time: performance.now()}];

      this.needsRender = true;
      return;
    }

    if (this.groupSelection) {
      if (this.pointsInsideBounds(x, y, this.groupSelection.bounds)) {
        this.initialGroupShapes = [...this.groupSelection.shapeIds].map((id) => this.findShape(id)).filter((shape) => shape !== undefined).map((shape) => structuredClone(shape));

        this.interaction = "groupMove";
        this.dragStart = { x, y };
        this.broadcastSelection(true);
        return;
      }
    }

    if (this.selectedTool !== "select" && this.selectedTool !== "pencil") {
      x = this.snap(x);
      y = this.snap(y);
    }

    if (this.selectedTool === "select") {
      let shape = this.selectedShapeId? this.findShape(this.selectedShapeId): null;

      this.initialShape = shape ? structuredClone(shape) : null;

      const local = shape ? this.getLocalPoint(shape, x, y) : null;

      const resizeShape = shape && local? this.isOnResizeHandle(shape, local.x, local.y) : null;
      const rotateShape = shape && local ? this.isOnRotationHandle(shape, local.x, local.y) : null;

      if (resizeShape) {
        this.interaction = "resizing";
        this.resizeHandle = resizeShape;
        if(shape?.type == "text"){
          this.textResizeMode = e.shiftKey? "wrap" : "scale";
          if(!this.hasSeenTextResizeBehaviour){
            this.hasSeenTextResizeBehaviour = true;
            this.showMsgListener?.(true);
          }
        }
        this.broadcastSelection(true);
        return;
      }

      if (rotateShape && shape) {
        this.interaction = "rotating";
        this.canvas.style.cursor = "grabbing";

        const boundings = this.getShapeBounds(shape);

        const cx = (boundings?.left! + boundings?.right!) / 2;
        const cy = (boundings?.bottom! + boundings?.top!) / 2;

        this.initialRotation = shape.rotation ?? 0;
        this.rotationStartAngle = Math.atan2(y - cy, x - cx);
        this.broadcastSelection(true);
        return;
      }

      shape = this.findShapeAtPoint(x, y);

      if (!shape) {
        this.shapeSelection(null);
        this.interaction = "marquee";

        this.marqueeStart = { x: x, y: y };

        this.selectionRect = { x, y, width: 0, height: 0 };
        return;
      }

      this.shapeSelection(shape.id);

      this.interaction = "moving";
      this.dragStart = { x, y };
      this.hasMoved = false;

      this.broadcastSelection(true);

      return;
    }

    this.interaction = "drawing";
    this.startX = x;
    this.startY = y;

    const id = crypto.randomUUID();

    switch (this.selectedTool) {
      case "rect":
        this.currentShape = {
          id,
          type: "rect",
          x,
          y,
          width: 0,
          height: 0,
          ...this.getCurrentStyling(),
        };
        break;

      case "ellipse":
        this.currentShape = {
          id,
          type: "ellipse",
          centerX: x,
          centerY: y,
          radX: 0,
          radY: 0,
          ...this.getCurrentStyling(),
        };
        break;

      case "diamond":
        this.currentShape = {
          id,
          type: "diamond",
          centerX: x,
          centerY: y,
          top: y,
          left: x,
          width: 0,
          height: 0,
          ...this.getCurrentStyling(),
        };
        break;

      case "line":
        this.currentShape = {
          id,
          type: "line",
          sX: x,
          sY: y,
          eX: x,
          eY: y,
          ...this.getCurrentStyling(),
        };
        break;

      case "pencil":
        this.currentShape = {
          id,
          type: "pencil",
          points: [{ x, y }],
          ...this.getCurrentStyling(),
        };
        break;

      case "arrow":
        this.currentShape = {
          id,
          type: "arrow",
          sX: x,
          sY: y,
          eX: x,
          eY: y,
          ...this.getCurrentStyling(),
        };
        break;

      case "text":
        {
          this.textEditorX = x;
          this.textEditorY = y;
        }
        break;
    }

    if (this.currentShape) {
      this.previewshapes.set("self", this.currentShape);
      this.broadcastSelection(true);
    }

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  };

  mouseUpHandler = (e: MouseEvent) => {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = "grab";
      return;
    }

    if (this.selectedTool === "laser") {
      this.isLaserDrawing = false;
      return;
    }

    this.broadcastSelection();

    if (this.interaction === "marquee") {
      const rect = this.normalizeRect(this.selectionRect!);

      const Ids = new Set<string>();

      for (const shape of this.existingShapes) {
        if (this.shapeIntersectsSelectionRect(shape, rect)) {
          Ids.add(shape.id);
        }
      }

      if (Ids.size) {
        this.groupSelection = {
          shapeIds: Ids,
          bounds: this.getGroupBounds(Ids),
        };
        this.groupSelected();
      } else {
        this.groupSelection = null;
        this.groupSelected();
      }

      this.selectionRect = null;
      this.selectedShapeId = null;
      this.canShowTextProperties?.(false);
      this.interaction = "idle";
      this.needsRender = true;
      return;
    }

    if (this.interaction === "groupMove") {
      const afterShapes = [...this.groupSelection!.shapeIds].map((id) => this.findShape(id)).filter((shape) => shape !== undefined).map((shape) => structuredClone(shape));

      this.undoStack.push({
        type: "group-update",
        before: this.initialGroupShapes!,
        after: afterShapes,
      });

      this.redoStack = [];

      if (this.socket.readyState == WebSocket.OPEN && afterShapes.length) {
        this.socket.send(
          JSON.stringify({
            type: "shapes:update",
            roomId: this.roomId,
            shapes: afterShapes,
          }),
        );
      }

      this.initialGroupShapes = null;
      this.interaction = "idle";
      return;
    }

    if (this.interaction === "moving" || this.interaction === "resizing" || this.interaction == "rotating") {
      const shape = this.findShape(this.selectedShapeId!);

      if(!shape){
        this.interaction = "idle";
        return;
      }

      if(this.interaction === "moving" && !this.hasMoved){
        this.interaction = "idle";
        this.resizeHandle = null;
        this.canvas.style.cursor = "default";
        return;
      }

      if (this.initialShape) {
        this.undoStack.push({
          type: "update",
          before: this.initialShape!,
          after: structuredClone(shape)!,
        });
        this.redoStack = [];
      }

      if (this.socket.readyState == WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "shape:update",
            roomId: this.roomId,
            shape,
          }),
        );
      }

      this.interaction = "idle";
      this.resizeHandle = null;
      this.canvas.style.cursor = "default";
      this.broadcastSelection(true);
      return;
    }

    if (this.selectedTool == "text") {
      this.createTextEditor(this.textEditorX, this.textEditorY);
      this.broadcastSelection(true);
      return;
    }

    if (!this.currentShape) {
      this.interaction = "idle";
      //this.selectedShapeId = null;
      return;
    }

    const shape = this.currentShape;

    if (!shape) return;

    if (!this.isLocked) {
      this.previewshapes.delete("self");
      this.addShape(shape);
      this.undoStack.push({
        type: "add",
        shape: structuredClone(shape),
      });
      this.redoStack = [];

      if (this.socket.readyState == WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "shape:add",
            roomId: this.roomId,
            shape: shape,
          }),
        );
      }
      this.currentShape = null;
      this.interaction = "idle";
      this.selectedShapeId = null;
      this.canShowTextProperties?.(false);
    }
  };

  mouseMoveHandler = (e: MouseEvent) => {
    if (this.isPanning) {
      const dx = e.clientX - this.panX;
      const dy = e.clientY - this.panY;

      this.offsetX += dx / this.scale;
      this.offsetY += dy / this.scale;

      this.panX = e.clientX;
      this.panY = e.clientY;

      this.needsRender = true;
      return;
    }

    let { x: endX, y: endY } = this.getMousePos(e);

    const now = performance.now();

    if (now - this.lastCursorSent >= this.CURSOR_INTERVAL) {
      this.lastCursorSent = now;
      if (this.socket.readyState == WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "cursor:update",
            roomId: this.roomId,
            x: endX,
            y: endY,
            laser: this.selectedTool === "laser" && this.isLaserDrawing,
            laserColor: this.strokeColor
          }),
        );
      }
    }

    if (this.selectedTool !== "pencil" && this.selectedTool !== "text") {
      endX = this.snap(endX);
      endY = this.snap(endY);
    }

    if (this.selectedTool === "laser") {
      if(!this.isLaserDrawing)return;

      const now = performance.now();

      const last = this.laserPoints[this.laserPoints.length - 1];

      if (!last ||Math.hypot(endX - last.x, endY - last.y) >= this.LASER_MIN_DISTANCE) {
        this.laserPoints.push({x: endX,y: endY,time: now,});
      }

      if (this.laserPoints.length > this.LASER_MAX_POINTS) {
        this.laserPoints.splice(0,this.laserPoints.length - this.LASER_MAX_POINTS);
      }

      this.needsRender = true;
      return;
    }

    if (this.interaction === "groupMove") {
      if (this.groupSelection?.bounds) {
        this.canvas.style.cursor = "move";

        const dx = endX - this.dragStart.x;
        const dy = endY - this.dragStart.y;

        for (const id of this.groupSelection?.shapeIds) {
          const shape = this.findShape(id)!;
          this.moveSelectedShape(shape, dx, dy);
        }

        this.dragStart = { x: endX, y: endY };
        this.groupSelection.bounds.x += dx;
        this.groupSelection.bounds.y += dy;
      }
      return;
    }

    if (this.selectedTool === "select" && this.interaction === "marquee") {
      this.selectionRect = {
        x: this.marqueeStart.x,
        y: this.marqueeStart.y,
        width: endX - this.marqueeStart.x,
        height: endY - this.marqueeStart.y,
      };
      this.needsRender = true;
      return;
    }

    if (this.selectedTool === "select" && this.interaction === "idle") {
      const shape = this.selectedShapeId? this.findShape(this.selectedShapeId): null;

      if (!shape) {
        this.canvas.style.cursor = "default";
      } else {
        const points = this.getLocalPoint(shape, endX, endY);
        const handle = this.isOnResizeHandle(shape, points.x, points.y);
        const onRotationHandle = this.isOnRotationHandle(shape, points.x, points.y);

        if (onRotationHandle) this.canvas.style.cursor = "grab";
        else if (handle === "tl" || handle === "br")
          this.canvas.style.cursor = "nwse-resize";
        else if (handle === "tr" || handle === "bl")
          this.canvas.style.cursor = "nesw-resize";
        else this.canvas.style.cursor = "move";
      }
    }

    if (this.selectedTool === "select" && this.interaction == "resizing") {
      const shape = this.findShape(this.selectedShapeId!);

      if (!shape) return;
      const local = this.getLocalPoint(shape, endX, endY);
      const handle = this.isOnResizeHandle(shape, local.x, local.y);

      if (handle) {
        if (handle === "br" || handle === "tl")
          this.canvas.style.cursor = "nwse-resize";
        else this.canvas.style.cursor = "nesw-resize";
      } else {
        this.canvas.style.cursor = "default";
      }

      if (shape.type === "rect") {
        const right = shape.x + shape.width;
        const bottom = shape.y + shape.height;

        switch (this.resizeHandle) {
          case "br":
            shape.width = local.x - shape.x;
            shape.height = local.y - shape.y;
            this.canvas.style.cursor = "nwse-resize";
            break;

          case "bl":
            shape.x = local.x;
            shape.width = right - local.x;
            shape.height = local.y - shape.y;
            this.canvas.style.cursor = "nesw-resize";
            break;

          case "tr":
            shape.y = local.y;
            shape.height = bottom - local.y;
            shape.width = local.x - shape.x;
            break;

          case "tl":
            shape.x = local.x;
            shape.y = local.y;
            shape.width = right - local.x;
            shape.height = bottom - local.y;
            break;
        }

        if (shape.width < 0) {
          shape.x += shape.width;
          shape.width = Math.abs(shape.width);
        }

        if (shape.height < 0) {
          shape.y += shape.height;
          shape.height = Math.abs(shape.height);
        }
      } else if (shape.type === "ellipse") {
        const left = shape.centerX - shape.radX;
        const top = shape.centerY - shape.radY;
        const right = shape.centerX + shape.radX;
        const bottom = shape.centerY + shape.radY;

        let newLeft = left;
        let newTop = top;
        let newRight = right;
        let newBottom = bottom;

        switch (this.resizeHandle) {
          case "tl":
            newLeft = local.x;
            newTop = local.y;
            break;

          case "tr":
            newRight = local.x;
            newTop = local.y;
            break;

          case "bl":
            newLeft = local.x;
            newBottom = local.y;
            break;

          case "br":
            newRight = local.x;
            newBottom = local.y;
            break;
        }

        if (newLeft > newRight) [newLeft, newRight] = [newRight, newLeft];

        if (newTop > newBottom) [newTop, newBottom] = [newBottom, newTop];

        shape.centerX = (newLeft + newRight) / 2;
        shape.centerY = (newTop + newBottom) / 2;
        shape.radX = (newRight - newLeft) / 2;
        shape.radY = (newBottom - newTop) / 2;
      } else if (shape.type === "diamond") {
        const right = shape.left + shape.width;
        const bottom = shape.top + shape.height;

        switch (this.resizeHandle) {
          case "br":
            shape.width = local.x - shape.left;
            shape.height = local.y - shape.top;
            break;

          case "bl":
            shape.width = right - local.x;
            shape.left = local.x;
            shape.height = local.y - shape.top;
            break;

          case "tr":
            shape.width = local.x - shape.left;
            shape.top = local.y;
            shape.height = bottom - local.y;
            break;

          case "tl":
            shape.left = local.x;
            shape.top = local.y;
            shape.width = right - local.x;
            shape.height = bottom - local.y;
            break;
        }

        if (shape.width < 0) {
          shape.left += shape.width;
          shape.width = Math.abs(shape.width);
        }

        if (shape.height < 0) {
          shape.top += shape.height;
          shape.height = Math.abs(shape.height);
        }

        shape.centerX = shape.left + shape.width / 2;
        shape.centerY = shape.top + shape.height / 2;
      } else if (shape.type === "line") {
        const left = Math.min(shape.sX, shape.eX);
        const right = Math.max(shape.sX, shape.eX);

        switch (this.resizeHandle) {
          case "tl":
            if (Math.abs(shape.sX - left) < Math.abs(shape.eX - left)) {
              shape.sX = local.x;
              shape.sY = local.y;
            } else {
              shape.eX = local.x;
              shape.eY = local.y;
            }
            break;

          case "tr":
            if (Math.abs(shape.sX - right) < Math.abs(shape.eX - right)) {
              shape.sX = local.x;
              shape.sY = local.y;
            } else {
              shape.eX = local.x;
              shape.eY = local.y;
            }
            break;

          case "bl":
            if (Math.abs(shape.sX - left) < Math.abs(shape.eX - left)) {
              shape.sX = local.x;
              shape.sY = local.y;
            } else {
              shape.eX = local.x;
              shape.eY = local.y;
            }
            break;

          case "br":
            if (Math.abs(shape.sX - right) < Math.abs(shape.eX - right)) {
              shape.sX = local.x;
              shape.sY = local.y;
            } else {
              shape.eX = local.x;
              shape.eY = local.y;
            }
            break;
        }
      } else if (shape.type === "arrow") {
        const left = Math.min(shape.sX, shape.eX);

        switch (this.resizeHandle) {
          case "tl":
          case "tr":
          case "bl":
          case "br":
            if (Math.abs(shape.sX - left) < Math.abs(shape.eX - left)) {
              shape.sX = local.x;
              shape.sY = local.y;
            } else {
              shape.eX = local.x;
              shape.eY = local.y;
            }
            break;
        }
      } else if (shape.type === "pencil") {
        const xs = shape.points.map((p) => p.x);
        const ys = shape.points.map((p) => p.y);

        const oldLeft = Math.min(...xs);
        const oldTop = Math.min(...ys);
        const oldRight = Math.max(...xs);
        const oldBottom = Math.max(...ys);

        let newLeft = oldLeft;
        let newTop = oldTop;
        let newRight = oldRight;
        let newBottom = oldBottom;

        switch (this.resizeHandle) {
          case "tl":
            newLeft = local.x;
            newTop = local.y;
            break;

          case "tr":
            newRight = local.x;
            newTop = local.y;
            break;

          case "bl":
            newLeft = local.x;
            newBottom = local.y;
            break;

          case "br":
            newRight = local.x;
            newBottom = local.y;
            break;
        }

        const newWidth = newRight - newLeft;
        const newHeight = newBottom - newTop;

        const oldWidth = oldRight - oldLeft;
        const oldHeight = oldBottom - oldTop;

        for (const p of shape.points) {
          const nx = oldWidth === 0 ? 0 : (p.x - oldLeft) / oldWidth;
          const ny = oldHeight === 0 ? 0 : (p.y - oldTop) / oldHeight;
          p.x = newLeft + nx * newWidth;
          p.y = newTop + ny * newHeight;
        }
      } else if (shape.type === "text") {
        const original = this.initialShape;

        if(!original || original.type !== "text")return;

        if(this.textResizeMode == "scale"){
          const oWidth = original.width;
          const oHeight = original.height;

          let newLeft = original.x;
          let newTop = original.y;
          let newRight = original.x + original.width;
          let newBottom = original.y + original.height;

          switch(this.resizeHandle){
            case "tl":
              newLeft = local.x;
              newTop = local.y;
              break;
            case "tr":
              newRight = local.x;
              newTop = local.y;
              break;
            case "bl":
              newLeft = local.x;
              newBottom = local.y;
              break;
            case "br":
              newRight = local.x;
              newBottom = local.y;
              break;
          }

          const newWidth = Math.max(20,Math.abs(newRight - newLeft));
          const newHeight = Math.max(20,Math.abs(newBottom - newTop));

          const scaleX = newWidth / Math.max(oWidth,1);
          const scaleY = newHeight / Math.max(oHeight,1);

          const scale = Math.max(scaleX,scaleY);

          shape.width = Math.max(20, oWidth * scale);
          shape.height = Math.max(20, oHeight * scale);

          shape.fontSize = Math.max(4, original.fontSize * scale);

          switch(this.resizeHandle){
            case "tl":
              shape.x = original.x + original.width - shape.width;
              shape.y = original.y + original.height - shape.height;
              break;
            case "tr":
              shape.x = original.x;
              shape.y = original.y + original.height - shape.height;
              break;
            case "bl":
              shape.x = original.x + original.width - shape.width;
              shape.y = original.y;
              break;
            case "br":
              shape.x = original.x;
              shape.y = original.y;
              break;
          }
          shape.textAutoResize = true;
        }
        else{
        const right = original.x + original.width;
        const bottom = original.y + original.height;

        switch (this.resizeHandle) {
          case "br":
            shape.x = original.x;
            shape.y = original.y;
            shape.width = Math.max(20, local.x - original.x);
            break;

          case "bl":
            shape.y = original.y;
            shape.x = Math.min(local.x,right - 20);
            shape.width = right - shape.x;
            break;

          case "tr":
            shape.x = original.x;
            shape.y = Math.min(local.y,bottom - 20);
            shape.width = Math.max(20, local.x - original.x);
            break;

          case "tl":
            shape.y = Math.min(local.y, bottom - 20);
            shape.x = Math.max(local.x, right - 20);
            shape.width = right - shape.x;
            break;
          }
          shape.fontSize = original.fontSize;
          shape.height = this.getWrappedTextHeight(shape);
          shape.textAutoResize = false;
        }     
      }

      this.needsRender = true;
      return;
    }

    if (this.interaction == "rotating") {
      const shape = this.selectedShapeId? this.findShape(this.selectedShapeId): null;
      if (!shape) return;

      const bounds = this.getShapeBounds(shape);

      const cx = (bounds?.left! + bounds?.right!) / 2;
      const cy = (bounds?.top! + bounds?.bottom!) / 2;

      const currentAngle = Math.atan2(endY - cy, endX - cx);
      const delta = currentAngle - this.rotationStartAngle;

      shape.rotation = this.initialRotation + delta;
      this.needsRender = true;
      return;
    }

    if (this.interaction == "moving") {
      this.canvas.style.cursor = "move";

      const dx = endX - this.dragStart.x;
      const dy = endY - this.dragStart.y;

      const shape = this.selectedShapeId? this.findShape(this.selectedShapeId) : null;
      if (!shape) return;

      if(dx!=0 || dy!=0){
        this.hasMoved = true;
      }

      this.moveSelectedShape(shape, dx, dy);

      this.dragStart = {
        x: endX,
        y: endY,
      };

      return;
    }

    if (this.interaction != "drawing") return;

    const dx = endX - this.lastPreviewPoint.x;
    const dy = endY - this.lastPreviewPoint.y;

    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

    this.lastPreviewPoint = {
      x: endX,
      y: endY,
    };

    const rawWidth = endX - this.startX;
    const rawHeight = endY - this.startY;

    const width = Math.abs(rawWidth);
    const height = Math.abs(rawHeight);

    const left = Math.min(this.startX, endX);
    const top = Math.min(this.startY, endY);

    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const radX = Math.abs(width) / 2;
    const radY = Math.abs(height) / 2;

    if (this.selectedTool !== "pencil") this.needsRender = true;

    switch (this.currentShape?.type) {
      case "rect":
        this.currentShape.x = left;
        this.currentShape.y = top;
        this.currentShape.width = width;
        this.currentShape.height = height;
        break;

      case "diamond":
        this.currentShape.centerX = centerX;
        this.currentShape.centerY = centerY;
        this.currentShape.left = left;
        this.currentShape.top = top;
        this.currentShape.width = width;
        this.currentShape.height = height;
        break;

      case "ellipse":
        this.currentShape.centerX = centerX;
        this.currentShape.centerY = centerY;
        this.currentShape.radX = radX;
        this.currentShape.radY = radY;
        break;

      case "line":
        this.currentShape.eX = endX;
        this.currentShape.eY = endY;
        break;

      case "pencil":
        this.currentShape.points.push({ x: endX, y: endY });
        break;

      case "arrow":
        this.currentShape.eX = endX;
        this.currentShape.eY = endY;
        break;
    }

    this.needsRender = true;

    if (this.currentShape) {
      const now = performance.now();

      if (now - this.lastPreviewSent >= this.PREVIEW_INTERVAL) {
        this.lastPreviewSent = now;

        if (this.socket.readyState == WebSocket.OPEN) {
          this.socket.send(
            JSON.stringify({
              type: "shape:preview",
              roomId: this.roomId,
              shape: this.currentShape,
            }),
          );
        }
      }
    }
  };
}