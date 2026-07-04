import { WebSocket } from "ws"

export interface Client {
    ws : WebSocket,
    userId : string | null,
    authenticated: boolean,
    rooms : Set<string>
}