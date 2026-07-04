import CanvasClient from "./CanvasClient";

export default async function CanvasPage({params}:{
    params:{
        roomId:string
    }
}){
    const roomId = (await params).roomId;
    return <CanvasClient roomId={roomId}></CanvasClient>
}