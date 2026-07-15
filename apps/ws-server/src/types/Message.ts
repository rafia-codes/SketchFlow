import { Shape } from "./Shape.js"

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
    type: "shape:preview" | "shape:add" | "shape:delete" | "shape:update" | "history:undo" | "history:redo",
    roomId : string,
    shape : Shape
}