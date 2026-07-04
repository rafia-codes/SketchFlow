"use client";
import { useEffect, useState } from "react";
import { Plus, LogOut, Users, Calendar, Divide, DoorOpen } from "lucide-react";
import { httpapiClient } from "../../lib/apiClient";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface Room {
  id: string;
  name: string;
  createdAt: string;
  participants: number;
}

export default function Dashboard() {
  const [rooms, setRooms] = useState<any>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const router = useRouter();
  const {user,loading,logout} = useAuth();

  const getRooms = async () => {
    console.log(28,'before');
    const res = await httpapiClient.get("/room");
    console.log(30, res);
    if (res.data.rooms?.length > 0) setRooms(res.data.rooms);
    console.log(31, rooms);
    setLoadingRooms(false);
  };

  useEffect(() => {
    console.log('useEffect k andar');
    getRooms();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const res = await httpapiClient.post("/room", { name: newRoomName });
    console.log(61, res);
    setMessage({ type: "success", text: res.data.message || "Success!" });

    getRooms();
    setTimeout(() => {
      setShowCreate(false);
    }, 1500);
  };

  const handlelogout = async () => {
    const res = await httpapiClient.post("logout");
    logout();
    router.push("/");
    console.log(res.data.message);
  };

  const joinRoom = () => {
    //@ts-ignore
    const link = document.querySelector('#room-code')?.value;
    const roomId  = link.split('/')[3];
    router.push(`/canvas/${roomId}`);
  }

  if(loading)
    return <>Loading...</>

  if(!user){
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-orange-50">
      {/* Top bar */}
      <header className="border-b border-orange-200 bg-white">
        <div className="container max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-800">Sketchflow</span>
          </div>

          <button
            onClick={handlelogout}
            className="cursor-pointer flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      {loadingRooms && (
        <div className="flex items-center justify-center justify-self-center place-items-center">
          Loading...
        </div>
      )}

      {/* Main */}
      {!loading && (
        <main className="container max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Your Rooms</h1>
              <p className="mt-1 text-gray-500">
                Create and manage your collaborative whiteboards.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowJoin(true)}
                className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium border-2 border-gray-700 hover:text-orange-600 hover:border-orange-600 transition-all duration-300 hover:-translate-y-0.5"
              >
                <DoorOpen className="w-4 h-4" />
                Join Room
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-300 hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                New Room
              </button>
              </div>
          </div>

          {showCreate && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowCreate(false)}
              />

              <div
                className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-orange-200 bg-white p-8 shadow-2xl shadow-black/5 animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowCreate(false)}
                  aria-label="Close modal"
                  className="cursor-pointer absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-800 hover:bg-orange-100 transition-colors"
                >
                  ✕
                </button>

                <h2 className="text-2xl font-bold text-gray-800">
                  Create Room
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Give your new whiteboard a name.
                </p>

                <form onSubmit={handleCreate} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="room-name"
                      className="block text-sm font-medium text-gray-800"
                    >
                      Room Name
                    </label>

                    <input
                      id="room-name"
                      type="text"
                      required
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="e.g. Sprint Planning"
                      className="flex h-10 w-full rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 md:text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="cursor-pointer w-full py-3 rounded-xl text-base font-medium bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 transition-all duration-300 hover:-translate-y-0.5"
                  >
                    Create
                  </button>
                </form>
                {message && (
                  <p
                    className={`mt-3 text-sm ${
                      message.type === "error"
                        ? "text-[hsl(0_84.2%_60.2%)]"
                        : "text-[hsl(114,85%,41%)]"
                    }`}
                  >
                    {message.text}
                  </p>
                )}
              </div>
            </div>
          )}

          {showJoin && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-gray-400/40"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="absolute inset-0 bg-foreground/60 backdrop-blur-sm"
                onClick={() => setShowJoin(false)}
              />
              <div
                className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-border bg-card p-8 shadow-2xl shadow-foreground/5 animate-in fade-in zoom-in-95 duration-200 bg-white"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowJoin(false)}
                  aria-label="Close modal"
                  className="cursor-pointer absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:text-gray-700 hover:bg-muted transition-colors"
                >
                  ✕
                </button>
                <h2 className="text-2xl font-bold text-gray-700">
                  Join Room
                </h2>
                <p className="mt-1 text-sm  text-gray-600">
                  Enter the link to join a whiteboard.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (joinCode.trim()) {
                      setJoinCode("");
                      setShowJoin(false);
                      joinRoom();
                    }
                  }}
                  className="mt-6 space-y-4"
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="room-code"
                      className="block text-sm font-medium text-foreground"
                    >
                      Paste the link
                    </label>
                    <input
                      id="room-code"
                      type="text"
                      required
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="e.g. ABC-1234"
                      className="h-10 w-full rounded-md border border-[hsl(40_15%_88%)]
                           bg-[hsl(40_33%_98%)] px-3 text-sm
                           placeholder:text-[hsl(220_10%_46%)]
                           focus:outline-none focus:ring-2 
                           focus:ring-[hsl(12_80%_58%)]
                           disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    className="cursor-pointer w-full py-3 rounded-xl text-base font-medium bg-orange-600 text-white hover:bg-orange-600/90 shadow-lg shadow-orange-600/25 hover:shadow-xl hover:shadow-orange-600/30 transition-all duration-300 hover:-translate-y-0.5"
                  >
                    Join
                  </button>
                </form>
              </div>
            </div>
          )}

          {rooms.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">
                No rooms yet. Create one to get started!
              </p>
            </div>
          )}

          {rooms.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from(rooms).map((room: any) => (
                <div
                  onClick={() => router.push(`/canvas/${room.id}`)}
                  key={room.id}
                  className="group rounded-2xl border border-orange-200 bg-white p-6 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 cursor-pointer"
                >
                  <h3 className="text-lg font-semibold text-gray-800 group-hover:text-orange-600 transition-colors">
                    {room.slug}
                  </h3>

                  <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                    {/* <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {room.participants}
                    </span> */}

                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {room.createdAt.split("T")[0]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
