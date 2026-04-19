"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db, generateRoomCode, getPlayerId } from "@/lib/firebase";
import { ref, get, set, update } from "firebase/database";

function getSession() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("coin_vote_session") ?? "null"); } catch { return null; }
}

export default function HomePage() {
  const router = useRouter();
  const session = getSession();
  const [name, setName] = useState(session?.displayName ?? "");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"home" | "join">("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createRoom() {
    if (!name.trim()) { setError("Enter your name first"); return; }
    setLoading(true);
    setError("");

    const playerId = getPlayerId();
    let code = generateRoomCode();

    // Ensure unique code
    for (let i = 0; i < 10; i++) {
      const snap = await get(ref(db, `rooms/${code}`));
      if (!snap.exists()) break;
      code = generateRoomCode();
    }

    await set(ref(db, `rooms/${code}`), {
      hostPlayerId: playerId,
      status: "lobby",
      currentQuestion: null,
      round: 0,
      currentAskerIndex: 0,
      playerOrder: [playerId],
      revealCountdownStart: null,
      createdAt: Date.now(),
      players: {
        [playerId]: { name: name.trim(), isHost: true, connected: true },
      },
    });

    localStorage.setItem("coin_vote_name", name.trim());
    router.push(`/room/${code}`);
  }

  async function joinRoom() {
    if (!name.trim()) { setError("Enter your name first"); return; }
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) { setError("Room code must be 4 letters"); return; }
    setLoading(true);
    setError("");

    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) {
      setError("Room not found. Check the code.");
      setLoading(false);
      return;
    }

    const playerId = getPlayerId();
    const currentOrder: string[] = snap.val()?.playerOrder ?? [];
    await update(ref(db, `rooms/${code}`), {
      [`players/${playerId}`]: { name: name.trim(), isHost: false, connected: true },
      playerOrder: [...currentOrder, playerId],
    });

    localStorage.setItem("coin_vote_name", name.trim());
    router.push(`/room/${code}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center mb-10">
        <div className="text-6xl mb-3 select-none">🪙</div>
        <h1 className="text-4xl font-black tracking-tight text-amber-300">
          十円 Coin Vote
        </h1>
        <p className="text-slate-400 mt-2 text-sm">
          Vote yes or no — hidden under a handkerchief!
        </p>
        {session && (
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-slate-400 text-xs">Signed in as <span className="text-amber-300 font-semibold">{session.displayName}</span></span>
            <button
              onClick={() => { localStorage.removeItem("coin_vote_session"); localStorage.removeItem("coin_vote_player_id"); window.location.reload(); }}
              className="text-slate-600 hover:text-slate-400 text-xs transition"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm shadow-2xl">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
          Your Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          placeholder="e.g. Yuki"
          maxLength={20}
          className="w-full bg-slate-800 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition mb-5"
        />

        {mode === "home" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={createRoom}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/20"
            >
              {loading ? "Creating…" : "✨ Create Room"}
            </button>
            <button
              onClick={() => { setMode("join"); setError(""); }}
              className="w-full bg-white/8 hover:bg-white/12 border border-white/15 text-white font-semibold py-3 rounded-xl transition-all active:scale-95"
            >
              🚪 Join Room
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                Room Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
                placeholder="ABCD"
                maxLength={4}
                className="w-full bg-slate-800 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-center text-2xl font-mono font-black tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
              />
            </div>
            <button
              onClick={joinRoom}
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              {loading ? "Joining…" : "🎉 Join Room"}
            </button>
            <button
              onClick={() => { setMode("home"); setError(""); }}
              className="text-slate-500 hover:text-slate-300 text-sm transition"
            >
              ← Back
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
        )}
      </div>

      <p className="mt-8 text-slate-600 text-xs">
        Up to 12 players per room · No account needed
      </p>
    </main>
  );
}
