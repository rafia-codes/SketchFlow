import { Tool } from "../components/Canvas";
import { Shape, BaseShape } from "./types";

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private roomId: string;
  private socket: WebSocket;
  private existingShapes: Shape[];
  private undoShapes: Shape[];
  private startX = 0;
  private startY = 0;
  private selectedTool: Tool = "rect";
  private isPanning = false;
  private panX = 0;
  private panY = 0;
  private offsetX = 0;
  private offsetY = 0;
  private scale = 1;
  private isLocked = false;
  private previewshapes: Map<string, Shape>;
  private currentShape: Shape | null;
  private needsRender: boolean;
  private animationFrameId: number | null;
  private lastPreviewSent: number;
  private lastPreviewPoint: { x: number; y: number };
  private readonly PREVIEW_INTERVAL = 33;
  private selectedShapeId: string | null;
  private interaction: "idle" | "drawing" | "moving" | "resizing" = "idle";
  private dragStart = {
    x: 0,
    y: 0,
  };
  private resizeHandle: "tl" | "tr" | "bl" | "br" | null = null;
  private SELECTION_PADDING = 5;
  private HANDLE_SIZE = 8;

  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.roomId = roomId;
    this.existingShapes = [];
    this.undoShapes = [];
    this.socket = socket;
    this.initHandlers();
    this.initMouseHandlers();
    this.isLocked = false;
    this.previewshapes = new Map<string, Shape>();
    this.currentShape = null;
    this.needsRender = true;
    this.animationFrameId = 0;
    this.render();
    this.lastPreviewSent = 0;
    this.lastPreviewPoint = { x: 0, y: 0 };
    this.selectedShapeId = null;
  }

  private getMousePos(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this.scale - this.offsetX,
      y: (e.clientY - rect.top) / this.scale - this.offsetY,
    };
  }

  setIsLocked(isLocked: boolean) {
    this.isLocked = isLocked;
  }

  setSelectedTool(tool: Tool) {
    this.selectedTool = tool;
    if (this.selectedTool !== "select") {
      this.selectedShapeId = null;
      this.interaction = "idle";
      this.needsRender = true;
    }
    this.canvas.style.cursor =
      tool == "hand" ? "grab" : tool == "select" ? "default" : "crosshair";
  }

  setScale(newScale: number) {
    this.scale = newScale;
    this.needsRender = true;
    console.log("now =", this.scale);
  }

  private shapeSelection(id: string | null) {
    this.selectedShapeId = id;
    this.currentShape = null;
    this.needsRender = true;
  }

  private drawSelectionBox(shape: Shape) {
    this.ctx.save();

    this.ctx.strokeStyle = "#3b82f6";
    this.ctx.lineWidth = 2 / this.scale;

    if (shape.type == "rect") {
      this.ctx.strokeRect(
        shape.x - this.SELECTION_PADDING,
        shape.y - this.SELECTION_PADDING,
        shape.width + 2 * this.SELECTION_PADDING,
        shape.height + 2 * this.SELECTION_PADDING,
      );

      const handles = [
        {
          x: shape.x - this.SELECTION_PADDING,
          y: shape.y - this.SELECTION_PADDING,
          dir: "tl",
        },
        {
          x: shape.x + shape.width + this.SELECTION_PADDING,
          y: shape.y - this.SELECTION_PADDING,
          dir: "tr",
        },
        {
          x: shape.x - this.SELECTION_PADDING,
          y: shape.y + shape.height + this.SELECTION_PADDING,
          dir: "bl",
        },
        {
          x: shape.x + shape.width + this.SELECTION_PADDING,
          y: shape.y + shape.height + this.SELECTION_PADDING,
          dir: "br",
        },
      ];

      this.ctx.fillStyle = "#3b82f6";

      handles.map((h) => {
        this.ctx.fillRect(
          h.x - this.HANDLE_SIZE / 2,
          h.y - this.HANDLE_SIZE / 2,
          this.HANDLE_SIZE,
          this.HANDLE_SIZE,
        );
      });
    } 
    
    else if (shape.type == "ellipse") {
      this.ctx.beginPath();

      const left = shape.centerX - shape.radX;
      const top = shape.centerY - shape.radY;
      const width = shape.radX * 2;
      const height = shape.radY * 2;

      this.ctx.strokeRect(
        left - this.SELECTION_PADDING,
        top - this.SELECTION_PADDING,
        width + 2 * this.SELECTION_PADDING,
        height + 2 * this.SELECTION_PADDING,
      );

      const handles = [
        { x: left - this.SELECTION_PADDING, y: top - this.SELECTION_PADDING },
        {
          x: left + width + this.SELECTION_PADDING,
          y: top - this.SELECTION_PADDING,
        },
        {
          x: left - this.SELECTION_PADDING,
          y: top + height + this.SELECTION_PADDING,
        },
        {
          x: left + width + this.SELECTION_PADDING,
          y: top + height + this.SELECTION_PADDING,
        },
      ];

      this.ctx.fillStyle = "#3b82f6";

      for (const h of handles) {
        this.ctx.fillRect(
          h.x - this.HANDLE_SIZE / 2,
          h.y - this.HANDLE_SIZE / 2,
          this.HANDLE_SIZE,
          this.HANDLE_SIZE,
        );
      }
    } 
    
    else if (shape.type == "diamond") {
      const left = shape.left;
      const top = shape.top;
      const width = shape.width;
      const height = shape.height;

      this.ctx.strokeRect(
        left - this.SELECTION_PADDING,
        top - this.SELECTION_PADDING,
        width + 2 * this.SELECTION_PADDING,
        height + 2 * this.SELECTION_PADDING,
      );

      const handles = [
        { x: left - this.SELECTION_PADDING, y: top - this.SELECTION_PADDING },
        {
          x: left + width + this.SELECTION_PADDING,
          y: top - this.SELECTION_PADDING,
        },
        {
          x: left - this.SELECTION_PADDING,
          y: top + height + this.SELECTION_PADDING,
        },
        {
          x: left + width + this.SELECTION_PADDING,
          y: top + height + this.SELECTION_PADDING,
        },
      ];

      this.ctx.fillStyle = "#3b82f6";

      for (const h of handles) {
        this.ctx.fillRect(
          h.x - this.HANDLE_SIZE / 2,
          h.y - this.HANDLE_SIZE / 2,
          this.HANDLE_SIZE,
          this.HANDLE_SIZE,
        );
      }
    } 
    
    else if (shape.type == "line") {
      const left = Math.min(shape.sX, shape.eX);
      const top = Math.min(shape.sY, shape.eY);

      const width = Math.abs(shape.eX - shape.sX);
      const height = Math.abs(shape.eY - shape.sY);

       this.ctx.strokeRect(
          left - this.SELECTION_PADDING,
          top - this.SELECTION_PADDING,
          width + this.SELECTION_PADDING * 2,
          height + this.SELECTION_PADDING * 2
        );


        const handles = [
          {x:left-this.SELECTION_PADDING, y:top-this.SELECTION_PADDING},
          {x:left+width+this.SELECTION_PADDING, y:top-this.SELECTION_PADDING},
          {x:left-this.SELECTION_PADDING, y:top+height+this.SELECTION_PADDING},
          {x:left+width+this.SELECTION_PADDING, y:top+height+this.SELECTION_PADDING}
        ];


        this.ctx.fillStyle="#3b82f6";

        for(const h of handles){
          this.ctx.fillRect(
            h.x-this.HANDLE_SIZE/2,
            h.y-this.HANDLE_SIZE/2,
            this.HANDLE_SIZE,
            this.HANDLE_SIZE
          );
        }
    } 
    
    else if (shape.type == "arrow") {
      const left = Math.min(shape.sX, shape.eX);
      const top = Math.min(shape.sY, shape.eY);
      const width = Math.abs(shape.eX - shape.sX);
      const height = Math.abs(shape.eY - shape.sY);

      this.ctx.strokeRect(
        left - this.SELECTION_PADDING,
        top - this.SELECTION_PADDING,
        width + this.SELECTION_PADDING * 2,
        height + this.SELECTION_PADDING * 2
      );

      const handles = [
        {x:left-this.SELECTION_PADDING, y:top-this.SELECTION_PADDING},
        {x:left+width+this.SELECTION_PADDING, y:top-this.SELECTION_PADDING},
        {x:left-this.SELECTION_PADDING, y:top+height+this.SELECTION_PADDING},
        {x:left+width+this.SELECTION_PADDING, y:top+height+this.SELECTION_PADDING}
      ];

      this.ctx.fillStyle="#3b82f6";

      for(const h of handles){
        this.ctx.fillRect(
          h.x-this.HANDLE_SIZE/2,
          h.y-this.HANDLE_SIZE/2,
          this.HANDLE_SIZE,
          this.HANDLE_SIZE
        );
      }
    }
    
    else if (shape.type == "pencil") {
      const xs = shape.points.map(p => p.x);
      const ys = shape.points.map(p => p.y);

      const left = Math.min(...xs);
      const top = Math.min(...ys);
      const width = Math.max(...xs) - left;
      const height = Math.max(...ys) - top;

      this.ctx.strokeRect(
        left - this.SELECTION_PADDING,
        top - this.SELECTION_PADDING,
        width + this.SELECTION_PADDING * 2,
        height + this.SELECTION_PADDING * 2
      );

      const handles = [
        {x:left-this.SELECTION_PADDING,y:top-this.SELECTION_PADDING},
        {x:left+width+this.SELECTION_PADDING,y:top-this.SELECTION_PADDING},
        {x:left-this.SELECTION_PADDING,y:top+height+this.SELECTION_PADDING},
        {x:left+width+this.SELECTION_PADDING,y:top+height+this.SELECTION_PADDING}
      ];

      this.ctx.fillStyle="#3b82f6";

      for(const h of handles){
        this.ctx.fillRect(
          h.x-this.HANDLE_SIZE/2,
          h.y-this.HANDLE_SIZE/2,
          this.HANDLE_SIZE,
          this.HANDLE_SIZE
        );
      }
    }

    this.ctx.restore();
  }

  private drawGrid() {
    const gridSize = 20;

    const left = -this.offsetX;
    const top = -this.offsetY;
    const right = left + this.canvas.width / this.scale;
    const bottom = top + this.canvas.height / this.scale;

    const startX = Math.floor(left / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;

    this.ctx.beginPath();
    this.ctx.strokeStyle = "#1f1f1f";
    this.ctx.lineWidth = 1 / this.scale;

    for (let x = startX; x <= right; x += gridSize) {
      this.ctx.moveTo(x, top);
      this.ctx.lineTo(x, bottom);
    }

    for (let y = startY; y <= bottom; y += gridSize) {
      this.ctx.moveTo(left, y);
      this.ctx.lineTo(right, y);
    }

    this.ctx.stroke();
  }

  private isPointOnRect(x: number,y: number,shape: Extract<Shape, { type: "rect" }>): boolean {
    const padding = 5 / this.scale;

    return (shape.x - padding <= x && x <= shape.x + shape.width + padding && shape.y - padding <= y && y <= shape.y + shape.height + padding);
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

  private isOnResizeHandle(shape: Shape,x: number,y: number): "tl" | "tr" | "bl" | "br" | null {
    let left: number;
    let top: number;
    let width: number;
    let height: number;

    if (shape.type === "rect") {
      left = shape.x;
      top = shape.y;
      width = shape.width;
      height = shape.height;
    } else if (shape.type === "ellipse") {
      left = shape.centerX - shape.radX;
      top = shape.centerY - shape.radY;
      width = shape.radX * 2;
      height = shape.radY * 2;
    } else if (shape.type === "diamond") {
      left = shape.left;
      top = shape.top;
      width = shape.width;
      height = shape.height;
    }else if (shape.type === "line") {
      left = Math.min(shape.sX, shape.eX);
      top = Math.min(shape.sY, shape.eY);
      width = Math.abs(shape.eX - shape.sX);
      height = Math.abs(shape.eY - shape.sY);
    }else if (shape.type === "arrow") {
      left = Math.min(shape.sX, shape.eX);
      top = Math.min(shape.sY, shape.eY);
      width = Math.abs(shape.eX - shape.sX);
      height = Math.abs(shape.eY - shape.sY);
    }else if(shape.type === "pencil") {
      const xs = shape.points.map(p=>p.x);
      const ys = shape.points.map(p=>p.y);

      left = Math.min(...xs);
      top = Math.min(...ys);
      width = Math.max(...xs)-left;
      height = Math.max(...ys)-top;
    }else {
      return null;
    }

    const p = this.SELECTION_PADDING;
    const s = this.HANDLE_SIZE / this.scale;

    const handles = {
      tl: { x: left - p, y: top - p },
      tr: { x: left + width + p, y: top - p },
      bl: { x: left - p, y: top + height + p },
      br: { x: left + width + p, y: top + height + p },
    };

    for (const key of ["tl", "tr", "bl", "br"] as const) {
      const h = handles[key];

      if (Math.abs(x - h.x) <= s && Math.abs(y - h.y) <= s) {
        return key;
      }
    }

    return null;
  }

  private findShapeAtPoint(x: number, y: number) {
    for (let i = this.existingShapes.length - 1; i >= 0; i--) {
      const shape = this.existingShapes[i];

      switch (shape.type) {
        case "rect":
          if (this.isPointOnRect(x, y, shape)) return shape;
          break;

        case "diamond":
          if (this.isPointOnDiamond(x, y, shape)) return shape;
          break;

        case "ellipse":
          if (this.isPointOnEllipse(x, y, shape)) return shape;
          break;

        case "arrow":
          if (this.isPointOnArrow(x, y, shape)) return shape;
          break;

        case "line":
          if (this.isPointOnLine(x, y, shape)) return shape;
          break;

        case "pencil":
          if (this.isPointOnPencil(x, y, shape)) return shape;
          break;
      }
    }
  }

  private render = () => {
    if (this.needsRender) {
      this.clearCanvas();
      this.needsRender = false;
    }
    this.animationFrameId = requestAnimationFrame(this.render);
  };

  private clearCanvas() {
    //changes required
    this.ctx.resetTransform();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "rgb(0,0,0)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.setTransform(
      this.scale,
      0,
      0,
      this.scale,
      this.offsetX * this.scale,
      this.offsetY * this.scale,
    );

    this.drawGrid();

    this.ctx.strokeStyle = "white";

    this.existingShapes?.forEach((shape) => this.drawShape(shape));

    if (this.selectedShapeId) {
      const selectedShape = this.findShape(this.selectedShapeId);
      if (selectedShape) {
        this.drawSelectionBox(selectedShape);
      }
    }

    for (const pshape of this.previewshapes.values()) {
      this.drawShape(pshape);
    }
  }

  private drawShape(shape: Shape | BaseShape | null) {
    if (!shape) return;
    if (shape.type === "rect") {
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
    }
  }

  private addShape(shape: Shape) {
    this.existingShapes.push(shape);
    this.needsRender = true;
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

  initHandlers() {
    this.socket.onmessage = (e) => {
      const received = JSON.parse(e.data);
      console.log(e.data);
      switch (received.type) {
        case "room_snapshot":
          console.log("got room snapshot");
          console.log(this.existingShapes);
          console.log(243, received.shapes);
          this.existingShapes = received.shapes;
          console.log(this.existingShapes);
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
        case "shape:update":
          this.updateShape(received.shape.id, received.shape);
          break;
        case "shape:delete":
          this.deleteShape(received.shape.id);
          break;
      }
    };
  }

  initMouseHandlers() {
    this.canvas.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas.addEventListener("mouseup", this.mouseUpHandler);
    this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
  }

  destroy() {
    if (this.animationFrameId !== null)
      cancelAnimationFrame(this.animationFrameId);
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
    this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
    this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
  }

  undo() {
    if (this.existingShapes.length === 0) return;

    const shape = this.existingShapes[this.existingShapes.length - 1];
    if (!shape) return;

    this.deleteShape(shape.id);
    this.undoShapes.push(shape);

    this.needsRender = true;

    if (this.socket.readyState == WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "history:undo",
          roomId: this.roomId,
          shape: shape.id,
          action: "undo",
        }),
      );
    }
  }

  redo() {
    if (this.undoShapes.length === 0) return;

    const shape = this.undoShapes.pop();
    if (!shape) return;

    this.addShape(shape);

    this.needsRender = true;

    if (this.socket.readyState == WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "history:redo",
          roomId: this.roomId,
          shapes: shape,
          action: "push",
        }),
      );
    }
  }

  private moveSelectedShape(dx: number, dy: number) {
    const shape = this.selectedShapeId
      ? this.findShape(this.selectedShapeId)
      : null;

    if (!shape) return;

    switch (shape.type) {
      case "rect":
        shape.x += dx;
        shape.y += dy;
        break;

      case "ellipse":
        shape.centerX += dx;
        shape.centerY += dy;
        break;

      case "diamond":
        shape.left += dx;
        shape.top += dy;
        shape.centerX += dx;
        shape.centerY += dy;
        break;

      case "line":
        shape.sX += dx;
        shape.sY += dy;
        shape.eX += dx;
        shape.eY += dy;
        break;

      case "arrow":
        shape.sX += dx;
        shape.sY += dy;
        shape.eX += dx;
        shape.eY += dy;
        break;

      case "pencil":
        for (const p of shape.points) {
          p.x += dx;
          p.y += dy;
        }
        break;
    }
    this.needsRender = true;
  }

  private deleteSelectedShape() {
    if (!this.selectedShapeId) return;

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

    this.selectedShapeId = null;
  }

  mouseDownHandler = (e: MouseEvent) => {
    if (this.selectedTool === "hand") {
      this.isPanning = true;
      this.canvas.style.cursor = "grabbing";

      this.panX = e.clientX;
      this.panY = e.clientY;
      return;
    }

    const { x, y } = this.getMousePos(e);

    if (this.selectedTool === "select") {
      let shape = this.selectedShapeId? this.findShape(this.selectedShapeId): null;

      const resizeShape = shape ? this.isOnResizeHandle(shape, x, y) : null;

      if (resizeShape && shape) {
        this.interaction = "resizing";
        this.resizeHandle = resizeShape;
        return;
      }

      shape = this.findShapeAtPoint(x, y);

      if (!shape) {
        this.shapeSelection(null);
        this.interaction = "idle";
        return;
      }

      this.shapeSelection(shape.id);

      this.interaction = "moving";
      this.dragStart = { x, y };

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
        };
        break;

      case "pencil":
        this.currentShape = {
          id,
          type: "pencil",
          points: [{ x, y }],
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
        };
        break;
    }

    if (this.currentShape) this.previewshapes.set("self", this.currentShape);

    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  };

  mouseUpHandler = (e: MouseEvent) => {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = "grab";
      return;
    }

    if (this.interaction === "moving" || this.interaction === "resizing") {
      const shape = this.findShape(this.selectedShapeId!);

      if (shape && this.socket.readyState == WebSocket.OPEN) {
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
      return;
    }

    if (!this.currentShape) {
      this.interaction = "idle";
      this.selectedShapeId = null;
      return;
    }

    const shape = this.currentShape;

    if (!shape) return;

    if (!this.isLocked) {
      this.previewshapes.delete("self");
      this.addShape(shape);
      this.undoShapes = [];

      console.log(this.socket.readyState);
      if (this.socket.readyState == WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "shape:add",
            roomId: this.roomId,
            shape: shape,
          }),
        );
      }
      console.log("sent shape 398");
      this.currentShape = null;
      this.interaction = "idle";
      this.selectedShapeId = null;
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

    const { x: endX, y: endY } = this.getMousePos(e);

    if (this.selectedTool === "select" && this.interaction === "idle") {
      const shape = this.selectedShapeId
        ? this.findShape(this.selectedShapeId)
        : null;

      if (!shape) {
        this.canvas.style.cursor = "default";
      } else {
        const handle = this.isOnResizeHandle(shape, endX, endY);

        if (handle === "tl" || handle === "br")
          this.canvas.style.cursor = "nwse-resize";
        else if (handle === "tr" || handle === "bl")
          this.canvas.style.cursor = "nesw-resize";
        else this.canvas.style.cursor = "move";
      }
    }

    if (this.selectedTool === "select" && this.interaction == "resizing") {
      const shape = this.findShape(this.selectedShapeId!);

      if (!shape) return;

      const handle = this.isOnResizeHandle(shape, endX, endY);

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
            shape.width = endX - shape.x;
            shape.height = endY - shape.y;
            this.canvas.style.cursor = "nwse-resize";
            break;

          case "bl":
            shape.x = endX;
            shape.width = right - endX;
            shape.height = endY - shape.y;
            this.canvas.style.cursor = "nesw-resize";
            break;

          case "tr":
            shape.y = endY;
            shape.height = bottom - endY;
            shape.width = endX - shape.x;
            break;

          case "tl":
            shape.x = endX;
            shape.y = endY;
            shape.width = right - endX;
            shape.height = bottom - endY;
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
      } 
      
      else if (shape.type === "ellipse") {
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
            newLeft = endX;
            newTop = endY;
            break;

          case "tr":
            newRight = endX;
            newTop = endY;
            break;

          case "bl":
            newLeft = endX;
            newBottom = endY;
            break;

          case "br":
            newRight = endX;
            newBottom = endY;
            break;
        }

        if (newLeft > newRight) [newLeft, newRight] = [newRight, newLeft];

        if (newTop > newBottom) [newTop, newBottom] = [newBottom, newTop];

        shape.centerX = (newLeft + newRight) / 2;
        shape.centerY = (newTop + newBottom) / 2;
        shape.radX = (newRight - newLeft) / 2;
        shape.radY = (newBottom - newTop) / 2;
      }

      else if (shape.type === "diamond") {

        const right = shape.left + shape.width;
        const bottom = shape.top + shape.height;

        switch(this.resizeHandle){

          case "br":
            shape.width = endX - shape.left;
            shape.height = endY - shape.top;
            break;

          case "bl":
            shape.width = right - endX;
            shape.left = endX;
            shape.height = endY - shape.top;
            break;

          case "tr":
            shape.width = endX - shape.left;
            shape.top = endY;
            shape.height = bottom - endY;
            break;

          case "tl":
            shape.left = endX;
            shape.top = endY;
            shape.width = right - endX;
            shape.height = bottom - endY;
            break;
        }

        if(shape.width < 0){
          shape.left += shape.width;
          shape.width = Math.abs(shape.width);
        }

        if(shape.height < 0){
          shape.top += shape.height;
          shape.height = Math.abs(shape.height);
        }

        shape.centerX = shape.left + shape.width / 2;
        shape.centerY = shape.top + shape.height / 2;
      }

      else if(shape.type === "line") {

          const left = Math.min(shape.sX, shape.eX);
          const right = Math.max(shape.sX, shape.eX);
          const top = Math.min(shape.sY, shape.eY);
          const bottom = Math.max(shape.sY, shape.eY);

        switch(this.resizeHandle){

          case "tl":
            if(Math.abs(shape.sX-left)<Math.abs(shape.eX-left)){
              shape.sX=endX;
              shape.sY=endY;
            }
            else{
              shape.eX=endX;
              shape.eY=endY;
            }
            break;

          case "tr":
            if(Math.abs(shape.sX-right)<Math.abs(shape.eX-right)){
              shape.sX=endX;
              shape.sY=endY;
            }
            else{
              shape.eX=endX;
              shape.eY=endY;
            }
            break;

          case "bl":
            if(Math.abs(shape.sX-left)<Math.abs(shape.eX-left)){
              shape.sX=endX;
              shape.sY=endY;
            }
            else{
              shape.eX=endX;
              shape.eY=endY;
            }
            break;

          case "br":
            if(Math.abs(shape.sX-right)<Math.abs(shape.eX-right)){
              shape.sX=endX;
              shape.sY=endY;
            }
            else{
              shape.eX=endX;
              shape.eY=endY;
            }
            break;
        }
      }

      else if(shape.type === "arrow") {

      const left = Math.min(shape.sX, shape.eX);
      const right = Math.max(shape.sX, shape.eX);
      const top = Math.min(shape.sY, shape.eY);
      const bottom = Math.max(shape.sY, shape.eY);

      switch(this.resizeHandle){
        case "tl":
        case "tr":
        case "bl":
        case "br":

          if(Math.abs(shape.sX-left) < Math.abs(shape.eX-left)){
            shape.sX=endX;
            shape.sY=endY;
          }
          else{
            shape.eX=endX;
            shape.eY=endY;
          }
          break;
      }
      }

      else if(shape.type === "pencil") {
        const xs = shape.points.map(p=>p.x);
        const ys = shape.points.map(p=>p.y);

        const oldLeft = Math.min(...xs);
        const oldTop = Math.min(...ys);
        const oldRight = Math.max(...xs);
        const oldBottom = Math.max(...ys);

        let newLeft = oldLeft;
        let newTop = oldTop;
        let newRight = oldRight;
        let newBottom = oldBottom;

        switch(this.resizeHandle){
          case "tl":
            newLeft=endX;
            newTop=endY;
            break;

          case "tr":
            newRight=endX;
            newTop=endY;
            break;

          case "bl":
            newLeft=endX;
            newBottom=endY;
            break;

          case "br":
            newRight=endX;
            newBottom=endY;
            break;
        }

        const newWidth = newRight-newLeft;
        const newHeight = newBottom-newTop;

        const oldWidth = oldRight-oldLeft;
        const oldHeight = oldBottom-oldTop;

        for(const p of shape.points){
          const nx = oldWidth === 0? 0: (p.x-oldLeft)/oldWidth;
          const ny =oldHeight === 0? 0: (p.y-oldTop)/oldHeight;
          p.x = newLeft + nx*newWidth;
          p.y = newTop + ny*newHeight;
        }
      }

      this.needsRender = true;
      return;
    }

    if (this.interaction == "moving") {
      this.canvas.style.cursor = "move";

      const dx = endX - this.dragStart.x;
      const dy = endY - this.dragStart.y;

      this.moveSelectedShape(dx, dy);

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

    this.ctx.strokeStyle = "white";

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
