"use client";
import { useRef, useEffect, useState } from "react";
import { WS_URL } from "@/config";
import { Canvas } from "./Canvas";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    console.log('inside room canvas');
    const ws = new WebSocket(WS_URL as string);
    const token = localStorage.getItem('token');
    ws.onopen = () => {
      console.log('ws open now');
      setSocket(ws);

      ws.onmessage = (e) => {
        console.log("Received:",e.data);
      }
      
      ws.send(JSON.stringify({
          type: "auth",
          token,
        }),
      );

      console.log('ws sent auth');
      

      ws.send(JSON.stringify({
        type: "join_room",
        roomId,
      }),
      );

      console.log('ws sent join_room');

      ws.onerror = (e) => {
        console.log("line 33" + e);
      };

    };



    ws.onclose=(e)=>{
      console.log("Socket Closed");
      console.log(e.code);
      console.log(e.reason);
    }

      return () => ws.close();
    }, []);


    if (!socket) {
      return <div>Connecting to Server...</div>;
    }

  return (
    <div className="h-screen w-screen">
      <Canvas roomId={roomId} socket={socket}></Canvas>
    </div>
  );
}
