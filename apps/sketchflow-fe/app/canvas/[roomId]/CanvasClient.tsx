'use client'
import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { RoomCanvas } from "@/components/RoomCanvas";

function CanvasClient({roomId}:{roomId:string}) {
    const {user,loading} = useAuth();
    const router = useRouter();

    useEffect(()=>{
        if(loading)return;
        if(!user)
            router.replace('/');
    },[user,router])

    if(loading){
        return <div>Loading...</div>
    }

    if(!user){
        return null;
    }

  return (
    <RoomCanvas roomId={roomId}></RoomCanvas>
  )
}

export default CanvasClient
