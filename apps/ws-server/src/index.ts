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
          //const label = `findMany ${crypto.randomUUID}`;
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

            //console.time(label);
            const chats = await prismaClient.chat.findMany({
              where: {
                roomId: Number(parsedData.roomId),
              },
              orderBy: {
                id: "asc",
              },
            });
            console.log(chats);

            ws.send(
              JSON.stringify({
                type: "room_snapshot",
                shapes: chats.map((chat: any) => JSON.parse(chat.message)),
              }),
            );
            console.log("sent room snapshot");
          } catch (error) {
            console.log(error);
          } finally {
            //console.timeEnd(label);
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

            //console.time("broadcast");
            broadcastToRoom(ws, "shape:preview", roomId, shape);
            //console.timeEnd("broadcast");
          } catch (error) {
            console.log(error);
          }
          break;

        case "shape:add":
          //const label = `shape:add ${crypto.randomUUID}`;
          try {
            //console.time("shape:add");
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId)) return;

            if (!rooms.get(parsedData.roomId)?.has(ws)) return;

            const roomId = parsedData.roomId;
            const shape = parsedData.shape;

            //console.time("broadcast");
            broadcastToRoom(ws, "shape:add", roomId, shape);
            //console.timeEnd("broadcast");

            //console.time("db:write");
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
            //console.timeEnd("db:write");
            //console.timeEnd("shape:add");
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

            //console.time("broadcast");
            broadcastToRoom(ws, "shape:delete", roomId, { id : parsedData.shape.id } as Shape);
            //console.timeEnd("broadcast");

            //console.time("db:delete");
            if (!roomId.startsWith("guest")) {
              //deleting in db
              await prismaClient.chat.delete({
                where: {
                  shapeId: parsedData.shape.id,
                },
              });
            }
            //console.timeEnd("db:delete");
            //console.timeEnd("shape:add");
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

            //console.time("broadcast");
            broadcastToRoom(ws, "shape:update", roomId, updatedShape);
            //console.timeEnd("broadcast");

            //console.time("db:update");
            if (!roomId.startsWith("guest")) {
              //updating in db
              await prismaClient.chat.update({
                where: {
                  shapeId: parsedData.shape.id,
                },
                data: {
                  message: JSON.stringify(updatedShape),
                },
              });
            }
            //console.timeEnd("db:update");
            //console.timeEnd("shape:add");
          } catch (error) {
            console.log(error);
          }
          break;

        case "history:undo":
          try {
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId)) return;

            if (!rooms.get(parsedData.roomId)?.has(ws)) return;

            const roomId = parsedData.roomId;
            const action = parsedData.action;

            console.log('received undo action');

            switch(action.type){
              case "add":
                //@ts-ignore
                broadcastToRoom(ws, "shape:delete", roomId, { id : parsedData.action.shape.id } as Shape);

                if(roomId.startsWith("guest"))return;

                const existing = await prismaClient.chat.findUnique({
                  where: {
                    //@ts-ignore
                    shapeId: parsedData.action.shape.id,
                  },
                });

                if (!existing) return;

                if (existing.roomId !== Number(roomId)) {
                  return;
                }

                
                await prismaClient.chat.delete({
                  where: {
                    //@ts-ignore
                    shapeId: parsedData.action.shape.id,
                  },
                });

                break;
              
              case "delete":
                broadcastToRoom(ws,"shape:add",roomId,action.shape);

                if(roomId.startsWith("guest"))return;

                const alreadyInDb = await prismaClient.chat.findUnique({
                    where:{
                        shapeId: action.shape.id
                    }
                });

                if(alreadyInDb) return;
                
                await prismaClient.chat.create({
                  data: {
                    //@ts-ignore
                    shapeId: parsedData.action.shape.id,
                    roomId: Number(roomId),
                    //@ts-ignore
                    message: JSON.stringify(parsedData.action.shape),
                    userId: getClient(ws)?.userId,
                  },
                });
                
                break;

              case "update":
                broadcastToRoom(ws,"shape:update",roomId,action.before);

                if(roomId.startsWith("guest"))return;

                const exists = await prismaClient.chat.findUnique({
                  where: {
                    //@ts-ignore
                    shapeId: parsedData.action.before.id,
                  },
                });

                if (!exists) return;

                if (exists.roomId !== Number(roomId)) {
                  return;
                }

                
                await prismaClient.chat.update({
                  where: {
                    //@ts-ignore
                    shapeId: parsedData.action.before.id,
                  },
                  data: {
                    //@ts-ignore
                    message: JSON.stringify(parsedData.action.before),
                  },
                });

                break;
            }

          } catch (error) {
            console.log(error);
          }
          break;

        case "history:redo":
          try {
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId)) return;

            if (!rooms.get(parsedData.roomId)?.has(ws)) return;

            const roomId = parsedData.roomId;
            const action = parsedData.action;

            switch(action.type){
              case "add":
                broadcastToRoom(ws, "shape:add", roomId, action.shape);

                const alreadyexists = await prismaClient.chat.findUnique({
                    where:{
                        shapeId: action.shape.id
                    }
                });

                if(alreadyexists) return;

                if (!roomId.startsWith("guest")) {
                //storing in db
                await prismaClient.chat.create({
                  data: {
                    //@ts-ignore
                    shapeId: action.shape.id,
                    roomId: Number(roomId),
                    message: JSON.stringify(action.shape),
                    userId: getClient(ws)?.userId,
                  },
                });
                }
            break;

            case "delete":
                  broadcastToRoom(ws, "shape:delete", roomId, { id : action.shape.id } as Shape);

                  if (roomId.startsWith("guest"))return;

                  const existing = await prismaClient.chat.findUnique({
                    where: {
                      shapeId: action.shape.id,
                    },
                  });

                  if (!existing) return;

                  if (existing.roomId !== Number(roomId)) {
                    return;
                  }
                   
                  //deleting in db
                  await prismaClient.chat.delete({
                    where: {
                      shapeId: action.shape.id,
                    },
                  });
                  
              break;

            case "update":
              broadcastToRoom(ws, "shape:update", roomId, action.after);

              if (roomId.startsWith("guest"))return;

              const exists = await prismaClient.chat.findUnique({
                  where: {
                    shapeId: action.before.id,
                  },
                });

                if (!exists) return;

                if (exists.roomId !== Number(roomId)) {
                  return;
                }

                //updating in db
                await prismaClient.chat.update({
                  where: {
                    shapeId: action.before.id,
                  },
                  data: {
                    message: JSON.stringify(action.after),
                  },
                });
              break;

            }
          } catch (error) {
            console.log(error);
          }
          break;
      }
    } catch (error) {
      console.log(480);
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
