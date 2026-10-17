import { Shape } from "./Shape.js"

export type HistoryAction =
  | {
      type: "add";
      shape: Shape;
    }
  | {
      type: "group-add";
      shapes: Shape[];
    }
  | {
      type: "delete";
      shape: Shape;
    }
  | {
      type: "group-delete";
      shapes: Shape[];
    }
  | {
      type: "update";
      before: Shape;
      after: Shape;
    }
  | {
      type: "group-update";
      before: Shape[];
      after: Shape[];
    }
  | {
    type: "layer";
    before: Shape[];
    after: Shape[]
  };

export type Message = {
    type: "auth",
    token: string
} | {
    type: "join_room",
    roomId : string,
} | {
    type: "leave_room",
    roomId : string,
} | {
    type: "shape:preview" | "shape:add" | "shape:delete" | "shape:update";
    roomId : string,
    shape : Shape
} | {
    type: "shapes:add" | "shapes:update";
    roomId : string,
    shapes : Shape[]
} | {
    type: "shapes:delete";
    roomId : string,
    shapeIds : string[]
} | {
    type : "history:undo" | "history:redo",
    roomId : string,
    action : HistoryAction
} | {
    type : "cursor:update",
    roomId : string,
    x : string,
    y : string,
    laser: boolean,
    laserColor? : string
} | {
    type : "layer:update",
    roomId : string,
    shapes : Shape[]
} | {
    type: "selection:update",
    roomId : string,
    shapeIds : string[],
    editing: boolean   
} | {
    type : "chats:reset",
    roomId : string
}| {
    type: "presentation:start" | "presentation:camera" | "presentation:join";
    roomId: string;
    scale: number;
    offsetX: number;
    offsetY: number;
}
| {
    type: "presentation:stop";
    roomId: string;
}

export type CursorPreview = {
    x: string,
    y: string,
};

export type Camera = {
    scale: number;
    offsetX: number;
    offsetY: number;
}