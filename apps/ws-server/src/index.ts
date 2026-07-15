import { WebSocketServer, WebSocket } from "ws";
import jwt, { Jwt, JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
import { Client } from "./types/Client.js";
import { Message } from "./types/Message.js";
import { Shape } from "./types/Shape.js";

const wss = new WebSocketServer({ port: 8080 });

const clients = new Map<WebSocket, Client>();
const rooms = new Map<string, Map<WebSocket, Client>>();

function checkClient(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

    if (!payload || !payload.id) return null;

    return payload.id as string;
  } catch (error) {
    return null;
  }
}

function getClient(ws: WebSocket): Client | undefined {
  return clients.get(ws);
}

function broadcastToRoom(
  ws: WebSocket,
  type: string,
  roomId: string,
  shape: Shape,
) {
  if (!rooms.has(roomId)) return;

  const client = clients.get(ws);

  rooms.get(roomId)?.forEach((user, userws) => {
    if (ws !== userws && userws.readyState == WebSocket.OPEN) {
      userws.send(
        JSON.stringify({
          type: type,
          shape: shape,
          userId: client?.userId,
        }),
      );
    }
  });
}

wss.on("listening", () => {
  console.log("WebSocket server live");
});

wss.on("connection", (ws, request) => {
  console.log("173 client connected");
  let client: Client = {
    ws,
    userId: null,
    authenticated: false,
    rooms: new Set(),
  };
  clients.set(ws, client);

  ws.on("message", async (data) => {
    try {
      let parsedData: Message;
      console.log(184, typeof data);
      parsedData = JSON.parse(data.toString());
      console.log(187, parsedData);

      if (!parsedData.type) return;

      switch (parsedData.type) {
        case "auth":
          console.log("191 auth");
          try {
            const userId = checkClient(parsedData.token);
            if (!userId) {
              ws.close();
              return;
            }
            client.authenticated = true;
            client.userId = userId;
          } catch (error) {
            console.log(error);
            ws.close();
          }
          break;

        case "join_room":
          console.log("join_room");
          try {
            if (parsedData.roomId.startsWith("guest")) {
              client.userId = "guest-" + crypto.randomUUID();
              client.authenticated = true;
            }
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId))
              rooms.set(parsedData.roomId, new Map());

            rooms.get(parsedData.roomId)?.set(ws, client);
            client.rooms.add(parsedData.roomId);

            console.time("findMany");
            const chats = await prismaClient.chat.findMany({
              where: {
                roomId: Number(parsedData.roomId),
              },
              orderBy: {
                id: "asc",
              },
            });
            console.log(chats);
            console.timeEnd("findMany");

            ws.send(
              JSON.stringify({
                type: "room_snapshot",
                shapes: chats.map((chat: any) => JSON.parse(chat.message)),
              }),
            );
            console.log("sent room snapshot");
          } catch (error) {
            console.log(error);
          }
          break;

        case "leave_room":
          try {
            if (clients.has(ws)) clients.delete(ws);
            if (
              rooms.has(parsedData.roomId) &&
              rooms.get(parsedData.roomId)?.has(ws)
            )
              rooms.get(parsedData.roomId)?.delete(ws);

            ws.close();
          } catch (error) {
            console.log(error);
          }
          break;

        case "shape:preview":
          try {
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId)) return;

            if (!rooms.get(parsedData.roomId)?.has(ws)) return;

            const roomId = parsedData.roomId;
            const shape = parsedData.shape;

            console.time("broadcast");
            broadcastToRoom(ws, "shape:preview", roomId, shape);
            console.timeEnd("broadcast");
          } catch (error) {
            console.log(error);
          }
          break;

        case "shape:add":
          try {
            console.time("shape:add");
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId)) return;

            if (!rooms.get(parsedData.roomId)?.has(ws)) return;

            const roomId = parsedData.roomId;
            const shape = parsedData.shape;

            console.time("broadcast");
            broadcastToRoom(ws, "shape:add", roomId, shape);
            console.timeEnd("broadcast");

            console.time("db:write");
            if (!roomId.startsWith("guest")) {
              //storing in db
              await prismaClient.chat.create({
                data: {
                  shapeId: parsedData.shape.id,
                  roomId: Number(roomId),
                  message: JSON.stringify(shape),
                  userId: getClient(ws)?.userId,
                },
              });
            }
            console.timeEnd("db:write");
            console.timeEnd("shape:add");
          } catch (error) {
            console.log(error);
          }
          break;

        case "shape:delete":
          try {
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId)) return;

            if (!rooms.get(parsedData.roomId)?.has(ws)) return;

            const roomId = parsedData.roomId;

            const existing = await prismaClient.chat.findUnique({
              where: {
                shapeId: parsedData.shape.id,
              },
            });

            if (!existing) return;

            if (existing.roomId !== Number(roomId)) {
              return;
            }

            console.time("broadcast");
            broadcastToRoom(ws, "shape:delete", roomId, parsedData.shape);
            console.timeEnd("broadcast");

            console.time("db:delete");
            if (!roomId.startsWith("guest")) {
              //storing in db
              await prismaClient.chat.delete({
                where: {
                  shapeId: parsedData.shape.id,
                },
              });
            }
            console.timeEnd("db:delete");
            console.timeEnd("shape:add");
          } catch (error) {
            console.log(error);
          }
          break;

        case "shape:update":
          try {
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId)) return;

            if (!rooms.get(parsedData.roomId)?.has(ws)) return;

            const roomId = parsedData.roomId;
            const updatedShape = parsedData.shape;

            const existing = await prismaClient.chat.findUnique({
              where: {
                shapeId: parsedData.shape.id,
              },
            });

            if (!existing) return;

            if (existing.roomId !== Number(roomId)) {
              return;
            }

            console.time("broadcast");
            broadcastToRoom(ws, "shape:update", roomId, updatedShape);
            console.timeEnd("broadcast");

            console.time("db:update");
            if (!roomId.startsWith("guest")) {
              //storing in db
              await prismaClient.chat.update({
                where: {
                  shapeId: parsedData.shape.id,
                },
                data: {
                  message: JSON.stringify(updatedShape),
                },
              });
            }
            console.timeEnd("db:update");
            console.timeEnd("shape:add");
          } catch (error) {
            console.log(error);
          }
          break;

        case "history:undo":
          try {
            if (!client.authenticated) return;
          } catch (error) {
            console.log(error);
          }
          break;

        case "history:redo":
          try {
            if (!client.authenticated) return;
          } catch (error) {
            console.log(error);
          }
          break;
      }
    } catch (error) {
      console.log(278);
      console.log(error);
    }
  });

  ws.on("close", () => {
    const existingrooms = getClient(ws)?.rooms;
    if (existingrooms)
      for (let room of existingrooms) {
        rooms.get(room)?.delete(ws);

        if (rooms.get(room)?.size == 0) rooms.delete(room);
      }
    clients.delete(ws);
  });
});
