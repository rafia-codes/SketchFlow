import { Shape } from "./Shape.js"

export type HistoryAction =
  | {
      type: "add";
      shape: Shape;
    }
  | {
      type: "delete";
      shape: Shape;
    }
  | {
      type: "update";
      before: Shape;
      after: Shape;
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
    type : "history:undo" | "history:redo",
    roomId : string,
    action : HistoryAction
}