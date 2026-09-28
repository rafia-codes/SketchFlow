import { WebSocketServer, WebSocket } from "ws";
import jwt, { Jwt, JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
import { Client } from "./types/Client.js";
import { CursorPreview, Message } from "./types/Message.js";
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

function broadcastToRoom(ws: WebSocket,type: string,roomId: string,data: Shape | CursorPreview | {name:string} | Shape[] | string[] | {shapeIds: string[], editing: boolean}) {
  if (!rooms.has(roomId)) return;

  const client = clients.get(ws);

  if(type == "cursor:update"){
    console.log('sending cursor updates');
    rooms.get(roomId)?.forEach((user,userws)=>{
      if(ws !== userws && userws.readyState == WebSocket.OPEN){
        userws.send(JSON.stringify({
          type: type,
          userId: client?.userId,
          ...data,
        }))
      }
    })
    return;
  }

  if(type == "layer:update"){
    const shapes = data as Shape[];
    rooms.get(roomId)?.forEach((user,userws) => {
      if(ws !== userws && userws.readyState == WebSocket.OPEN){
        userws.send(JSON.stringify({
          type: type,
          roomId: roomId,
          shapes: shapes,
        }))
      }
    })
    return;
  }

  if(type == "shapes:add" || type == "shapes:update"){
    const shapes = data as Shape[];
    rooms.get(roomId)?.forEach((user,userws) => {
      if(ws !== userws && userws.readyState == WebSocket.OPEN){
        userws.send(JSON.stringify({
          type: type,
          roomId: roomId,
          shapes: shapes
        }))
      }
    })
    return;
  }

  if(type == "shapes:delete"){
    const shapeIds = data as unknown as string[];
    rooms.get(roomId)?.forEach((user,userws) => {
      if(ws !== userws && userws.readyState == WebSocket.OPEN){
        userws.send(JSON.stringify({
          type: type,
          roomId: roomId,
          shapeIds: shapeIds
        }))
      }
    })
    return;
  }

  if(type == "selection:update"){
    const payload = data as unknown as { shapeIds: string[]; editing: boolean};

    rooms.get(roomId)?.forEach((user,userws)=>{
      if(ws !== userws && userws.readyState == WebSocket.OPEN){
        userws.send(JSON.stringify({
          type: type,
          userId: client?.userId,
          shapeIds: payload.shapeIds,
          editing: payload.editing
        }))
      }
    })
    return;
  }

  if(type == "user:joined" || type == "user:left"){
    rooms.get(roomId)?.forEach((user,userws)=>{
      if(ws !== userws && userws.readyState == WebSocket.OPEN){
        userws.send(JSON.stringify({
          type: type,
          userId: client?.userId,
          name: client?.name,
          color: client?.color
        }))
      }
    })
    return;
  }

  rooms.get(roomId)?.forEach((user, userws) => {
    if (ws !== userws && userws.readyState == WebSocket.OPEN) {
      userws.send(
        JSON.stringify({
          type: type,
          shape: data,
          userId: client?.userId,
        }),
      );
    }
  });
}

wss.on("listening", () => {
  console.log("WebSocket server live");
});

function randomColor(){
  const r = Math.floor(Math.random()*156) + 100;
  const g = Math.floor(Math.random()*156) + 100;
  const b = Math.floor(Math.random()*156) + 100;

  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

wss.on("connection", (ws, request) => {
  console.log("173 client connected");
  let client: Client = {
    ws,
    userId: null,
    authenticated: false,
    rooms: new Set(),
    name: "",
    color: ""
  };
  clients.set(ws, client);

  ws.on("message", async (data) => {
    try {
      let parsedData: Message;
      parsedData = JSON.parse(data.toString());

      if (!parsedData.type) return;

      switch (parsedData.type) {
        case "auth":
          //console.log("191 auth");
          try {
            const userId = checkClient(parsedData.token);
            if (!userId) {
              ws.close();
              return;
            }
            client.authenticated = true;
            client.userId = userId;

            client.color = randomColor();
            
            const user = await prismaClient.user.findUnique({
              where:{
                id: userId
              }
            });

            if(!user)return;

            client.name = user.name;
          } catch (error) {
            console.log(error);
            ws.close();
          }
          break;

        case "join_room":
          try {
            if (parsedData.roomId.startsWith("guest")) {
              client.userId = "guest-" + crypto.randomUUID();
              client.authenticated = true;
              client.color = randomColor();
              client.name = "Guest";
            }
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId))
              rooms.set(parsedData.roomId, new Map());

            if (rooms.get(parsedData.roomId)?.has(ws)) {
              return;
            }

            rooms.get(parsedData.roomId)?.set(ws, client);
            client.rooms.add(parsedData.roomId);

            let chats = [];

            chats = await prismaClient.chat.findMany({
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

            broadcastToRoom(ws,"user:joined",parsedData.roomId,{name: client.name});//those who are already there

            rooms.get(parsedData.roomId)?.forEach((user,userws)=>{//for those who have joined later n getting info of the ones who have already joined
              if(ws !== userws && userws.readyState == WebSocket.OPEN){
                ws.send(JSON.stringify({
                  type:"user:joined",
                  userId: user.userId,
                  name: user.name,
                  color: user.color
                }));
              }
            });

            console.log("sent room snapshot");
          } catch (error) {
            console.log(error);
          } finally {
          }
          break;

        case "leave_room":
          try {
            if (!clients.has(ws)) return;
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

        case "cursor:update":{
          if (!client.authenticated) return;

          if (!rooms.has(parsedData.roomId)) return;

          if (!rooms.get(parsedData.roomId)?.has(ws)) return;

          const roomId = parsedData.roomId;
          const x = parsedData.x;
          const y = parsedData.y;

          broadcastToRoom(ws,"cursor:update",roomId,{ x: x, y: y});
        }
        break;

        case "selection:update":{
          if (!client.authenticated) return;

          if (!rooms.has(parsedData.roomId)) return;

          if (!rooms.get(parsedData.roomId)?.has(ws)) return;

          const roomId = parsedData.roomId;

          broadcastToRoom(ws,"selection:update",roomId,{
            shapeIds: parsedData.shapeIds as string[],
            editing: parsedData.editing
          })
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

        case "shapes:add":
          try {
            //console.time("shape:add");
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId)) return;

            if (!rooms.get(parsedData.roomId)?.has(ws)) return;

            const roomId = parsedData.roomId;
            const shapes = parsedData.shapes;

            //console.time("broadcast");
            broadcastToRoom(ws, "shapes:add", roomId, shapes);
            //console.timeEnd("broadcast");

            //console.time("db:write");
            if (!roomId.startsWith("guest")) {
              //storing in db
              await prismaClient.chat.createMany({
                data: shapes.map((shape) => ({
                  shapeId : shape.id,
                  roomId: Number(roomId),
                  message: JSON.stringify(shape),
                  userId: getClient(ws)?.userId
                })),
                skipDuplicates: true
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

            //console.time("broadcast");
            broadcastToRoom(ws, "shape:delete", roomId, { id : parsedData.shape.id } as Shape);
            //console.timeEnd("broadcast");

            if (!existing) return;

            if (existing.roomId !== Number(roomId)) {
              return;
            }

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

        case "shapes:delete":
          try {
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId)) return;

            if (!rooms.get(parsedData.roomId)?.has(ws)) return;

            const roomId = parsedData.roomId;
            const shapeIds = parsedData.shapeIds;

            //console.time("broadcast");
            broadcastToRoom(ws, "shapes:delete", roomId, shapeIds);
            //console.timeEnd("broadcast");

            //console.time("db:delete");
            if (!roomId.startsWith("guest")) {
              //deleting in db
              await prismaClient.chat.delete({
                where: {
                  shapeId: {
                    in: shapeIds
                  },
                  roomId: Number(roomId)
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

            //console.time("broadcast");
            broadcastToRoom(ws, "shape:update", roomId, updatedShape);
            //console.timeEnd("broadcast");

            if (!existing) return;

            if (existing.roomId !== Number(roomId)) {
              return;
            }

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

        case "shapes:update":
          try {
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId)) return;

            if (!rooms.get(parsedData.roomId)?.has(ws)) return;

            const roomId = parsedData.roomId;
            const updatedShapes = parsedData.shapes;

            //console.time("broadcast");
            broadcastToRoom(ws, "shapes:update", roomId, updatedShapes);
            //console.timeEnd("broadcast");

            //console.time("db:update");
            if (!roomId.startsWith("guest")) {
              //updating in db
              await prismaClient.$transaction(
                updatedShapes.map((shape) => 
                prismaClient.chat.update({
                  where:{shapeId: shape.id, roomId: Number(roomId)},
                  data: {message : JSON.stringify(shape)}
                })
                )
              )
            }
            //console.timeEnd("db:update");
            //console.timeEnd("shape:add");
          } catch (error) {
            console.log(error);
          }
          break;

        case "history:undo":
          try {
            console.log(515);
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

              case "group-add":{
                const shapesIds = action.shapes.map(s => s.id);

                broadcastToRoom(ws,"shapes:delete",roomId,shapesIds);

                if(!roomId.startsWith('guest')){
                  await prismaClient.chat.deleteMany({
                    where: {
                      shapeId : {
                        in : shapesIds
                      },
                      roomId: Number(roomId)
                    }
                  });
                }
              }
              break;

              case "group-delete":{
                const shapes: Shape[] = action.shapes;

                broadcastToRoom(ws,"shapes:add",roomId,shapes);

                if(!roomId.startsWith('guest')){
                  await prismaClient.chat.createMany({
                    data: shapes.map((s) => ({
                      shapeId: s.id,
                      roomId: Number(roomId),
                      message: JSON.stringify(s),
                      userId: getClient(ws)?.userId
                    })),
                    skipDuplicates: true
                  })
                }
              }
              break;

              case "group-update":{
                console.log("653 server: undoing group-update", action.before?.length, "shapes");
                const shapes: Shape[] = action.before;

                broadcastToRoom(ws, "shapes:update", roomId, shapes);

                if(!roomId.startsWith('guest')){
                  await prismaClient.$transaction(
                    shapes.map((shape) => 
                    prismaClient.chat.updateMany({
                      where:{ shapeId : shape.id, roomId: Number(roomId)},
                      data: { message: JSON.stringify(shape)}
                    })
                    )
                  )
                }
              }
              break;

              case "layer":{
                  const shapesToRestore: Shape[] = action.before;

                  broadcastToRoom(ws,"layer:update",roomId,shapesToRestore);

                  if(roomId.startsWith('guest'))return;

                  await Promise.all(
                    shapesToRestore.map((shape) => 
                    prismaClient.chat.updateMany({
                      where:{ shapeId: shape.id, roomId: Number(roomId)},
                      data: {
                        message: JSON.stringify(shape)
                      }
                    }))
                  );
                }
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

            case "group-add":{
              const shapes: Shape[] = action.shapes;

              broadcastToRoom(ws,"shapes:add",roomId,shapes);

              if(!roomId.startsWith('guest')){
                await prismaClient.chat.createMany({
                  data: shapes.map((s) => ({
                    shapeId: s.id,
                    roomId: Number(roomId),
                    message: JSON.stringify(s),
                    userId: getClient(ws)?.userId
                  })),
                  skipDuplicates: true
                })
              }
            }
            break;

            case "group-delete":{
              const shapesIds = action.shapes.map(s => s.id);

              broadcastToRoom(ws,"shapes:delete",roomId,shapesIds);

              if(!roomId.startsWith('guest')){
                await prismaClient.chat.deleteMany({
                  where: {
                    shapeId : {
                      in : shapesIds
                    },
                    roomId: Number(roomId)
                  }
                });
              }
            }
            break;

            case "group-update":{
              const shapes: Shape[] = action.after;

              broadcastToRoom(ws, "shapes:update", roomId, shapes);

              if(!roomId.startsWith('guest')){
                await prismaClient.$transaction(
                  shapes.map((shape) => 
                  prismaClient.chat.updateMany({
                    where:{ shapeId : shape.id, roomId: Number(roomId)},
                    data: { message: JSON.stringify(shape)}
                  })
                  )
                )
              }
            }
            break;

            case "layer":{
                  const shapesToRestore: Shape[] = action.after;

                  broadcastToRoom(ws,"layer:update",roomId,shapesToRestore);

                  if(roomId.startsWith('guest'))return;

                  await Promise.all(
                    shapesToRestore.map((shape) => 
                    prismaClient.chat.updateMany({
                      where:{ shapeId: shape.id, roomId: Number(roomId)},
                      data: {
                        message: JSON.stringify(shape)
                      }
                    }))
                  );
                }
                break;
            }
          } catch (error) {
            console.log(error);
          }
          break;
        
        case "layer:update":
          try {
            if (!client.authenticated) return;

            if (!rooms.has(parsedData.roomId)) return;

            if (!rooms.get(parsedData.roomId)?.has(ws)) return;

            const roomId = parsedData.roomId;
            const shapes = parsedData.shapes;

            broadcastToRoom(ws,"layer:update",roomId,shapes);

            if(!roomId.startsWith('guest')){
              await Promise.all(
                shapes.map((shape) => 
                prismaClient.chat.updateMany({
                  where:{shapeId: shape.id, roomId: Number(roomId)},
                  data: {
                    message: JSON.stringify(shape)
                  }
                }))
              );
            }
            break;
          }catch{
            console.log('Error in layer update');
          }
      }
    } catch (error) {
      console.log(480);
      console.log(error);
    }
  });

  ws.on("close", () => {
    const existingrooms = getClient(ws)?.rooms;
    if (existingrooms)
      for (let roomId of existingrooms) {
        rooms.get(roomId)?.delete(ws);

        if (rooms.get(roomId)?.size == 0) rooms.delete(roomId);
        else {
          rooms.get(roomId)?.forEach((user,userws)=>{
            if(userws.readyState == WebSocket.OPEN){
              userws.send(JSON.stringify({
                type: "user:left",
                name : getClient(ws)?.name,
                userId: getClient(ws)?.userId,
                color: getClient(ws)?.color
              }))
            }
          })
        }
      }
    clients.delete(ws);
  });
});
