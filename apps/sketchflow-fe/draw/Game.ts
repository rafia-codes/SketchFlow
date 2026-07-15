import { Tool } from "../components/Canvas";

type Points = {
  x: number;
  y: number;
};

type BaseShape =
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      type: "ellipse";
      radX: number;
      radY: number;
      centerX: number;
      centerY: number;
    }
  | {
      type: "diamond";
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      top: number;
      left: number;
    }
  | {
      type: "line";
      sX: number;
      sY: number;
      eX: number;
      eY: number;
    }
  | {
      type: "pencil";
      points: Array<Points>;
    }
  | {
      type: "hand";
    }
  | {
      type: "arrow";
      sX: number;
      sY: number;
      eX: number;
      eY: number;
    };

type Shape = BaseShape & {
  id: string;
};

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private roomId: string;
  private socket: WebSocket;
  private existingShapes: Shape[];
  private undoShapes: Shape[];
  private startX = 0;
  private startY = 0;
  private clicked: boolean;
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

  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.roomId = roomId;
    this.existingShapes = [];
    this.undoShapes = [];
    this.socket = socket;
    this.clicked = false;
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
    this.canvas.style.cursor = tool == "hand" ? "grab" : "crosshair";
  }

  setScale(newScale: number) {
    this.scale = newScale;
    this.needsRender = true;
    console.log("now =", this.scale);
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

      const angle = Math.atan2(
        shape.eY - shape.sY,
        shape.eX - shape.sX
      );

      this.ctx.beginPath();
      
      this.ctx.moveTo(shape.sX,shape.sY);
      this.ctx.lineTo(shape.eX,shape.eY);

      this.ctx.lineTo(
        shape.eX - headLength * Math.cos(angle - Math.PI/6),
        shape.eY - headLength * Math.sin(angle - Math.PI/6)
      );

      this.ctx.moveTo(shape.eX,shape.eY);

      this.ctx.lineTo(
        shape.eX - headLength * Math.cos(angle + Math.PI/6),
        shape.eY - headLength * Math.sin(angle + Math.PI/6)
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

  mouseDownHandler = (e: MouseEvent) => {
    if (this.selectedTool === "hand") {
      this.isPanning = true;
      this.canvas.style.cursor = "grabbing";

      this.panX = e.clientX;
      this.panY = e.clientY;
      return;
    }

    const { x, y } = this.getMousePos(e);

    this.clicked = true;
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
          points: [{x,y}],
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
    console.log(this.isLocked);
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = "grab";
      return;
    }

    this.clicked = false;

    if (!this.currentShape) return;

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

    if (!this.clicked) return;

    const { x: endX, y: endY } = this.getMousePos(e);

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
      console.time("send msg over socket");
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

      console.timeEnd("send msg over socket");
    }
  };
}
