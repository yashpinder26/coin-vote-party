"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, getPlayerId } from "@/lib/firebase";
import { ref, onValue, update, set, get } from "firebase/database";
import CoinCard from "@/components/CoinCard";

type GamePhase = "loading" | "lobby" | "voting" | "reveal" | "not_found";

interface RoomData {
  hostPlayerId: string;
  status: GamePhase;
  currentQuestion: string | null;
  round: number;
  players: Record<string, { name: string; isHost: boolean; connected: boolean }>;
  votes: Record<string, { vote: boolean; round: number }>;
}

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const upperCode = code.toUpperCase();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [question, setQuestion] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  const playerId = getPlayerId();
  const unsubRef = useRef<(() => void) | null>(null);

  const players = Object.entries(room?.players ?? {}).map(([id, p]) => ({ id, ...p }));
  const votes = Object.entries(room?.votes ?? {})
    .filter(([, v]) => v.round === (room?.round ?? 0))
    .map(([playerId, v]) => ({ playerId, ...v }));

  const isHost = room?.hostPlayerId === playerId;
  const myVote = votes.find((v) => v.playerId === playerId);
  const eligibleVoters = players.filter((p) => !p.isHost || players.length === 1);
  const votedCount = votes.length;
  const allVoted = votedCount >= eligibleVoters.length && eligibleVoters.length > 0;
  const yesCount = votes.filter((v) => v.vote === true).length;
  const noCount = votes.filter((v) => v.vote === false).length;

  // Subscribe to room
  useEffect(() => {
    const roomRef = ref(db, `rooms/${upperCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) {
        setPhase("not_found");
        return;
      }
      const data = snap.val() as RoomData;
      setRoom(data);
      setPhase(data.status);
    });
    unsubRef.current = unsub;
    return () => unsub();
  }, [upperCode]);

  // Mark connected
  useEffect(() => {
    if (!room) return;
    set(ref(db, `rooms/${upperCode}/players/${playerId}/connected`), true);
  }, [upperCode, playerId, room?.hostPlayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  function runCountdown(onDone: () => void) {
    let n = 3;
    setCountdown(n);
    const iv = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(iv); setCountdown(null); onDone(); }
      else setCountdown(n);
    }, 800);
  }

  async function startRound() {
    if (!question.trim()) return;
    setActionLoading(true);
    await update(ref(db, `rooms/${upperCode}`), {
      status: "voting",
      currentQuestion: question.trim(),
    });
    setQuestion("");
    setActionLoading(false);
  }

  async function revealVotes() {
    runCountdown(async () => {
      await update(ref(db, `rooms/${upperCode}`), { status: "reveal" });
    });
  }

  async function nextRound() {
    if (!room) return;
    setActionLoading(true);
    // Clear votes for new round
    await update(ref(db, `rooms/${upperCode}`), {
      status: "lobby",
      currentQuestion: null,
      round: room.round + 1,
      votes: null,
    });
    setActionLoading(false);
  }

  async function castVote(vote: boolean) {
    if (myVote) return;
    await set(ref(db, `rooms/${upperCode}/votes/${playerId}`), {
      vote,
      round: room?.round ?? 0,
    });
  }

  function copyCode() {
    navigator.clipboard.writeText(upperCode).then(() => {
      setCopyMsg("Copied!");
      setTimeout(() => setCopyMsg(""), 2000);
    });
  }

  function RoomCodeDisplay() {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {upperCode.split("").map((ch, i) => (
            <span key={i} className="room-code-letter text-amber-300">{ch}</span>
          ))}
        </div>
        <button
          onClick={copyCode}
          className="text-xs text-slate-500 hover:text-slate-300 transition px-2 py-1 rounded bg-white/5"
        >
          {copyMsg || "copy"}
        </button>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-amber-400 animate-pulse-slow text-lg">Loading room…</div>
      </div>
    );
  }

  if (phase === "not_found") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-5xl">🔍</div>
        <p className="text-slate-400">Room <strong className="text-white">{upperCode}</strong> not found.</p>
        <button onClick={() => router.push("/")} className="text-amber-400 hover:underline">← Back to home</button>
      </div>
    );
  }

  if (countdown !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="countdown-digit animate-countdown-pop">{countdown}</div>
      </div>
    );
  }

  // ── LOBBY ────────────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-8 max-w-lg mx-auto">
        <div className="w-full flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Room Code</p>
            <RoomCodeDisplay />
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-0.5">Round {(room?.round ?? 0) + 1}</p>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Lobby</span>
          </div>
        </div>

        <div className="text-4xl mb-4">🪙</div>
        <h2 className="text-xl font-bold text-amber-300 mb-6">
          {isHost ? "You're the host!" : "Waiting for host…"}
        </h2>

        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Players ({players.length})</p>
          <div className="flex flex-col gap-2">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${p.connected ? "bg-green-400" : "bg-slate-600"}`} />
                <span className={`font-medium ${p.id === playerId ? "text-amber-300" : "text-white"}`}>{p.name}</span>
                {p.isHost && <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded ml-auto">host</span>}
                {p.id === playerId && !p.isHost && <span className="text-xs text-slate-600 ml-auto">you</span>}
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <div className="w-full flex flex-col gap-3">
            <label className="text-xs text-slate-400 uppercase tracking-widest">Ask a yes/no question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Would you rather live in a foreign country?"
              rows={3}
              maxLength={200}
              className="w-full bg-slate-800 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition resize-none"
            />
            <button
              onClick={startRound}
              disabled={!question.trim() || actionLoading || players.length < 2}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-all active:scale-95"
            >
              {players.length < 2 ? "Waiting for players…" : "🚀 Start Voting"}
            </button>
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center animate-pulse-slow">The host is typing a question…</p>
        )}
      </main>
    );
  }

  // ── VOTING ───────────────────────────────────────────────────────────────────
  if (phase === "voting") {
    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-8 max-w-2xl mx-auto">
        <div className="w-full flex items-center justify-between mb-6">
          <RoomCodeDisplay />
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Voting</span>
        </div>

        <div className="w-full bg-white/5 border border-amber-500/20 rounded-2xl p-5 mb-8 text-center">
          <p className="text-xs text-amber-500/60 uppercase tracking-widest mb-2">Question</p>
          <p className="text-lg font-semibold text-white leading-snug">{room?.currentQuestion}</p>
        </div>

        <div className="w-full grid grid-cols-3 gap-6 mb-8 place-items-center sm:grid-cols-4">
          {players.map((p, idx) => {
            const pVote = votes.find((v) => v.playerId === p.id);
            const isSelf = p.id === playerId;
            return (
              <CoinCard
                key={p.id}
                playerName={p.name}
                playerIndex={idx}
                hasVoted={!!pVote}
                vote={isSelf && pVote ? pVote.vote : null}
                revealed={false}
                isSelf={isSelf}
                onVote={castVote}
                disabled={!!myVote}
              />
            );
          })}
        </div>

        <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-slate-400">{votedCount} / {eligibleVoters.length} voted</span>
          <div className="flex gap-1">
            {eligibleVoters.map((p) => (
              <div key={p.id} className={`w-2 h-2 rounded-full transition-all ${votes.find((v) => v.playerId === p.id) ? "bg-amber-400" : "bg-slate-700"}`} />
            ))}
          </div>
        </div>

        {isHost && (
          <button
            onClick={revealVotes}
            disabled={votedCount === 0}
            className="w-full max-w-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-purple-500/20"
          >
            {allVoted ? "🎭 Reveal Votes!" : `Waiting… (${votedCount}/${eligibleVoters.length})`}
          </button>
        )}
        {!isHost && <p className="text-slate-600 text-xs text-center">Waiting for host to reveal…</p>}
      </main>
    );
  }

  // ── REVEAL ───────────────────────────────────────────────────────────────────
  if (phase === "reveal") {
    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-8 max-w-2xl mx-auto">
        <div className="w-full flex items-center justify-between mb-6">
          <RoomCodeDisplay />
          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">Reveal!</span>
        </div>

        <div className="w-full bg-white/5 border border-purple-500/20 rounded-2xl p-5 mb-6 text-center">
          <p className="text-xs text-purple-400/60 uppercase tracking-widest mb-2">Question</p>
          <p className="text-lg font-semibold text-white leading-snug">{room?.currentQuestion}</p>
        </div>

        <div className="flex gap-4 mb-8">
          <div className="flex-1 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-center glow-yes">
            <p className="text-3xl font-black text-green-400">{yesCount}</p>
            <p className="text-xs text-green-500/70 uppercase tracking-wider mt-0.5">Yes</p>
          </div>
          <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-center glow-no">
            <p className="text-3xl font-black text-red-400">{noCount}</p>
            <p className="text-xs text-red-500/70 uppercase tracking-wider mt-0.5">No</p>
          </div>
        </div>

        <div className="w-full grid grid-cols-3 gap-6 mb-8 place-items-center sm:grid-cols-4">
          {players.map((p, idx) => {
            const pVote = votes.find((v) => v.playerId === p.id);
            return (
              <CoinCard
                key={p.id}
                playerName={p.name}
                playerIndex={idx}
                hasVoted={!!pVote}
                vote={pVote?.vote ?? null}
                revealed={true}
                isSelf={p.id === playerId}
              />
            );
          })}
        </div>

        {yesCount !== noCount && (
          <div className={`animate-fade-in-scale text-lg font-black px-6 py-3 rounded-2xl mb-6 ${yesCount > noCount ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30"}`}>
            {yesCount > noCount ? "✓ The group said YES!" : "✗ The group said NO!"}
          </div>
        )}
        {yesCount === noCount && yesCount > 0 && (
          <div className="animate-fade-in-scale text-lg font-black px-6 py-3 rounded-2xl mb-6 bg-amber-500/20 text-amber-300 border border-amber-500/30">
            🤝 It&apos;s a tie!
          </div>
        )}

        {isHost && (
          <button onClick={nextRound} disabled={actionLoading} className="w-full max-w-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-all active:scale-95">
            Next Round →
          </button>
        )}
        {!isHost && <p className="text-slate-600 text-xs text-center mt-2">Waiting for host to start next round…</p>}
      </main>
    );
  }

  return null;
}
