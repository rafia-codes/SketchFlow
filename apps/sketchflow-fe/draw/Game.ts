import { Tool } from "../components/Canvas";

type Points = {
  x: number;
  y: number;
};

type Shape =
  | {
      id: string;
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      id: string;
      type: "ellipse";
      radX: number;
      radY: number;
      centerX: number;
      centerY: number;
    }
  | {
      id: string;
      type: "diamond";
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      top: number;
      left: number;
    }
  | {
      id: string;
      type: "line";
      sX: number;
      sY: number;
      eX: number;
      eY: number;
    }
  | {
      id: string;
      type: "pencil";
      points: Array<Points>;
    }
  | {
      id: string;
      type: "hand";
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
  private points: Points[] = [];
  private isPanning = false;
  private panX = 0;
  private panY = 0;
  private offsetX = 0;
  private offsetY = 0;
  private scale = 1;
  private isLocked = false;

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
    this.points = [];
    this.isLocked = false;
  }

  getMousePos(e: MouseEvent) {
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
    this.clearCanvas();
    console.log("now =", this.scale);
  }

  drawGrid() {
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

  clearCanvas() {
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

    this.existingShapes?.forEach((shape) => {
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
      }
    });
  }

  private addShape(shape:Shape){
    this.existingShapes.push(shape);
    this.clearCanvas();
  }

  private findShape(shapeId:string): Shape | undefined{
    return this.existingShapes.find(shape => shape.id === shapeId);
  }

  private updateShape(shapeId:string,updatedShape:Partial<Shape>){
    const idx = this.existingShapes.findIndex(shape => shape.id == shapeId);
    if(idx == -1)return;

    this.existingShapes[idx] = {...this.existingShapes[idx],...updatedShape} as Shape;
  }

  private deleteShape(shapeId:string){
    const idx = this.existingShapes.findIndex(shape => shape.id == shapeId);
    if(idx == -1)return;

    this.existingShapes.splice(idx,1);
    this.clearCanvas();
  }

  initHandlers() {
    this.socket.onmessage = (e) => {
      const message = JSON.parse(e.data);
      console.log(e.data);
      switch (message.type) {
        case "room_snapshot":
          console.log('got room snapshot');
          console.log(this.existingShapes);
          this.existingShapes = message.shapes.map((shape:any)=>{
            return JSON.parse(shape.message);
          });
          console.log(this.existingShapes);
          this.clearCanvas();
          break;
        case "shape:add":
          this.addShape(message.shape);
          break;
        case "shape:update":
          this.updateShape(message.shape.id,message.shape);
          break;
        case "shape:delete":
          this.deleteShape(message.shape.id);
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

    this.clearCanvas();

    this.socket.send(
      JSON.stringify({
        type: "history:undo",
        roomId: this.roomId,
        shape: shape.id,
        action: "undo",
      }),
    );
  }

  redo() {
    if (this.undoShapes.length === 0) return;

    const shape = this.undoShapes.pop();
    if (!shape) return;

    this.addShape(shape);

    this.clearCanvas();

    this.socket.send(
      JSON.stringify({
        type: "history:redo",
        roomId: this.roomId,
        shapes: shape,
        action: "push",
      }),
    );
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

    this.points = [{ x, y }];

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

    const { x: endX, y: endY } = this.getMousePos(e);
    this.clicked = false;

    const width = Math.abs(endX - this.startX);
    const height = Math.abs(endY - this.startY);

    const left = Math.min(this.startX, endX);
    const top = Math.min(this.startY, endY);

    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const radX = Math.abs(width) / 2;
    const radY = Math.abs(height) / 2;

    let shape: Shape | null = null;

    if (this.selectedTool === "rect") {
      shape = {
        id: crypto.randomUUID(),
        type: "rect",
        x: left,
        y: top,
        width,
        height,
      };
    } else if (this.selectedTool === "ellipse") {
      shape = {
        id: crypto.randomUUID(),
        type: "ellipse",
        centerX: centerX,
        centerY: centerY,
        radX,
        radY,
      };
    } else if (this.selectedTool === "diamond") {
      shape = {
        id: crypto.randomUUID(),
        type: "diamond",
        centerX: centerX,
        centerY: centerY,
        top: top,
        left: left,
        width,
        height,
      };
    } else if (this.selectedTool === "line") {
      shape = {
        id: crypto.randomUUID(),
        type: "line",
        sX: this.startX,
        sY: this.startY,
        eX: endX,
        eY: endY,
      };
    } else if (this.selectedTool === "pencil") {
      shape = {
        id: crypto.randomUUID(),
        type: "pencil",
        points: this.points,
      };
    }

    if (!shape) return;

    if (!this.isLocked) {
      this.addShape(shape);
      this.undoShapes = [];

      console.log(this.socket.readyState);
      this.socket.send(
        JSON.stringify({
          type: "shape:add",
          roomId: this.roomId,
          shape: shape,
        }),
      );
      console.log('sent shape 398');
    }

    this.points = [];
  };

  mouseMoveHandler = (e: MouseEvent) => {
    if (this.isPanning) {
      const dx = e.clientX - this.panX;
      const dy = e.clientY - this.panY;

      this.offsetX += dx / this.scale;
      this.offsetY += dy / this.scale;

      this.panX = e.clientX;
      this.panY = e.clientY;

      this.clearCanvas();
      return;
    }

    if (!this.clicked) return;

    const { x: endX, y: endY } = this.getMousePos(e);

    const width = endX - this.startX;
    const height = endY - this.startY;

    const left = Math.min(this.startX, endX);
    const top = Math.min(this.startY, endY);

    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const radX = Math.abs(width) / 2;
    const radY = Math.abs(height) / 2;

    if (this.selectedTool !== "pencil") this.clearCanvas();

    this.ctx.strokeStyle = "white";

    if (this.selectedTool === "rect") {
      this.ctx.strokeRect(this.startX, this.startY, width, height);
    } else if (this.selectedTool === "ellipse") {
      this.ctx.beginPath();
      this.ctx.ellipse(centerX, centerY, radX, radY, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    } else if (this.selectedTool === "diamond") {
      const topPoint = { x: centerX, y: top };
      const rightPoint = { x: left + width, y: centerY };
      const bottomPoint = { x: centerX, y: top + height };
      const leftPoint = { x: left, y: centerY };

      this.ctx.beginPath();
      this.ctx.moveTo(topPoint.x, topPoint.y);
      this.ctx.lineTo(rightPoint.x, rightPoint.y);
      this.ctx.lineTo(bottomPoint.x, bottomPoint.y);
      this.ctx.lineTo(leftPoint.x, leftPoint.y);
      this.ctx.closePath();
      this.ctx.stroke();
    } else if (this.selectedTool === "line") {
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX, this.startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
    } else if (this.selectedTool === "pencil") {
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
      this.points.push({ x: endX, y: endY });
    } else if(this.selectedTool === "arrow") {
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX,this.startY);
      
    }
  };
}
