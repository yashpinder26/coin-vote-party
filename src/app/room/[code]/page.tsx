"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, getPlayerId } from "@/lib/firebase";
import { ref, onValue, update, set } from "firebase/database";
import CoinCard from "@/components/CoinCard";

type GamePhase = "loading" | "lobby" | "asking" | "voting" | "reveal" | "not_found";

interface RoomData {
  hostPlayerId: string;
  status: GamePhase;
  currentQuestion: string | null;
  round: number;
  currentAskerIndex: number;
  playerOrder: string[];
  revealCountdownStart: number | null;
  players: Record<string, { name: string; isHost: boolean; connected: boolean }>;
  votes: Record<string, { vote: boolean; round: number }>;
}

function AnonymousCoin({ vote, index }: { vote: boolean; index: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="coin-scene" style={{ width: 70, height: 70 }}>
        <div className={`coin-inner ${!vote ? "flipped" : ""}`} style={{ width: 70, height: 70 }}>
          <div className="coin-face front" style={{ fontSize: "1.2rem" }}>
            <span>十</span>
            <span style={{ fontSize: "0.6rem", fontWeight: 900, color: "#78350f" }}>YES</span>
            <div className="coin-rim" />
          </div>
          <div className="coin-face back" style={{ fontSize: "1.2rem" }}>
            <span>円</span>
            <span style={{ fontSize: "0.6rem", fontWeight: 900, color: "#78350f" }}>NO</span>
            <div className="coin-rim" />
          </div>
        </div>
      </div>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full animate-fade-in-scale ${vote ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
        {vote ? "YES" : "NO"}
      </span>
    </div>
  );
}

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const upperCode = code.toUpperCase();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [question, setQuestion] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);

  const playerId = getPlayerId();
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived state
  const playerOrder: string[] = room?.playerOrder ?? [];
  const players = playerOrder
    .map((id) => room?.players[id] ? { id, ...room.players[id] } : null)
    .filter(Boolean) as { id: string; name: string; isHost: boolean; connected: boolean }[];

  const currentAskerIndex = room?.currentAskerIndex ?? 0;
  const currentAskerId = playerOrder[currentAskerIndex] ?? room?.hostPlayerId ?? "";
  const currentAskerName = room?.players[currentAskerId]?.name ?? "...";
  const isAsker = playerId === currentAskerId;
  const isHost = room?.hostPlayerId === playerId;
  const myPlayerNumber = playerOrder.indexOf(playerId) + 1;

  const votes = Object.entries(room?.votes ?? {})
    .filter(([, v]) => v.round === (room?.round ?? 0))
    .map(([pid, v]) => ({ playerId: pid, ...v }));

  const eligibleVoters = players.filter((p) => p.id !== currentAskerId);
  const votedCount = votes.filter((v) => v.playerId !== currentAskerId).length;
  const allVoted = votedCount >= eligibleVoters.length && eligibleVoters.length > 0;
  const myVote = votes.find((v) => v.playerId === playerId);

  const yesCount = votes.filter((v) => v.vote === true).length;
  const noCount = votes.filter((v) => v.vote === false).length;

  // Subscribe to room
  useEffect(() => {
    const roomRef = ref(db, `rooms/${upperCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) { setPhase("not_found"); return; }
      const data = snap.val() as RoomData;
      setRoom(data);
      setPhase(data.status);
    });
    return () => unsub();
  }, [upperCode]);

  // Mark connected
  useEffect(() => {
    if (!room) return;
    set(ref(db, `rooms/${upperCode}/players/${playerId}/connected`), true);
  }, [upperCode, playerId, room?.hostPlayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-reveal countdown when all voted
  useEffect(() => {
    if (!room?.revealCountdownStart || phase !== "voting") {
      setRevealCountdown(null);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    const start = room.revealCountdownStart;
    const DELAY = 5000;

    // Countdown display
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      const remaining = Math.ceil((DELAY - (Date.now() - start)) / 1000);
      setRevealCountdown(Math.max(0, remaining));
    }, 100);

    // Auto-reveal after 5s
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, DELAY - elapsed);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      update(ref(db, `rooms/${upperCode}`), { status: "reveal" });
    }, remaining);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [room?.revealCountdownStart, phase, upperCode]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function startGame() {
    await update(ref(db, `rooms/${upperCode}`), { status: "asking", currentAskerIndex: 0 });
  }

  async function submitQuestion() {
    if (!question.trim()) return;
    setActionLoading(true);
    await update(ref(db, `rooms/${upperCode}`), {
      status: "voting",
      currentQuestion: question.trim(),
      revealCountdownStart: null,
    });
    setQuestion("");
    setActionLoading(false);
  }

  async function castVote(vote: boolean) {
    if (myVote || isAsker) return;
    await set(ref(db, `rooms/${upperCode}/votes/${playerId}`), { vote, round: room?.round ?? 0 });

    // If this completes all votes, start countdown
    const newCount = votedCount + 1;
    if (newCount >= eligibleVoters.length && !room?.revealCountdownStart) {
      await update(ref(db, `rooms/${upperCode}`), { revealCountdownStart: Date.now() });
    }
  }

  async function nextRound() {
    if (!room) return;
    setActionLoading(true);
    const nextIndex = (currentAskerIndex + 1) % playerOrder.length;
    await update(ref(db, `rooms/${upperCode}`), {
      status: "asking",
      currentQuestion: null,
      round: room.round + 1,
      currentAskerIndex: nextIndex,
      revealCountdownStart: null,
      votes: null,
    });
    setActionLoading(false);
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
        <button onClick={copyCode} className="text-xs text-slate-500 hover:text-slate-300 transition px-2 py-1 rounded bg-white/5">
          {copyMsg || "copy"}
        </button>
      </div>
    );
  }

  // ── Loading / Not Found ───────────────────────────────────────────────────────
  if (phase === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-amber-400 animate-pulse-slow text-lg">Loading room…</div></div>;
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

  // ── LOBBY ────────────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-8 max-w-lg mx-auto">
        <div className="w-full flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Room Code</p>
            <RoomCodeDisplay />
          </div>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Lobby</span>
        </div>

        <div className="text-4xl mb-4">🪙</div>
        <h2 className="text-xl font-bold text-amber-300 mb-6">Waiting for players…</h2>

        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Players ({players.length})</p>
          <div className="flex flex-col gap-2">
            {players.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-xs font-black text-slate-500 w-5">#{idx + 1}</span>
                <div className={`w-2 h-2 rounded-full ${p.connected ? "bg-green-400" : "bg-slate-600"}`} />
                <span className={`font-medium ${p.id === playerId ? "text-amber-300" : "text-white"}`}>{p.name}</span>
                {p.id === playerId && <span className="text-xs text-slate-600 ml-auto">you</span>}
                {p.isHost && <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded ml-auto">host</span>}
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button
            onClick={startGame}
            disabled={players.length < 2}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-all active:scale-95"
          >
            {players.length < 2 ? "Waiting for players…" : "🚀 Start Game"}
          </button>
        ) : (
          <p className="text-slate-500 text-sm text-center animate-pulse-slow">Waiting for host to start…</p>
        )}
      </main>
    );
  }

  // ── ASKING ───────────────────────────────────────────────────────────────────
  if (phase === "asking") {
    const nextAskerName = room?.players[playerOrder[(currentAskerIndex + 1) % playerOrder.length]]?.name;
    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-8 max-w-lg mx-auto">
        <div className="w-full flex items-center justify-between mb-6">
          <RoomCodeDisplay />
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Round {(room?.round ?? 0) + 1}</span>
        </div>

        {/* Turn indicator */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {players.map((p, idx) => (
              <div key={p.id} className={`flex flex-col items-center gap-1 flex-shrink-0 px-3 py-2 rounded-xl transition-all ${idx === currentAskerIndex ? "bg-amber-500/20 border border-amber-500/40" : "opacity-40"}`}>
                <span className="text-xs text-slate-500">#{idx + 1}</span>
                <span className={`text-sm font-bold ${p.id === playerId ? "text-amber-300" : "text-white"}`}>{p.name}</span>
                {idx === currentAskerIndex && <span className="text-xs text-amber-400">🎤 asking</span>}
              </div>
            ))}
          </div>
        </div>

        {isAsker ? (
          <div className="w-full flex flex-col gap-3">
            <div className="text-center mb-2">
              <p className="text-amber-300 font-bold text-lg">Your turn to ask!</p>
              <p className="text-slate-500 text-sm">Player #{myPlayerNumber}</p>
            </div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type a yes/no question…"
              rows={3}
              maxLength={200}
              className="w-full bg-slate-800 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition resize-none"
            />
            <button
              onClick={submitQuestion}
              disabled={!question.trim() || actionLoading}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-all active:scale-95"
            >
              Start Voting 🗳️
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 mt-4">
            <div className="text-5xl animate-pulse-slow">🤔</div>
            <p className="text-white font-semibold text-lg text-center">
              <span className="text-amber-300">{currentAskerName}</span> is thinking of a question…
            </p>
          </div>
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

        <div className="w-full bg-white/5 border border-amber-500/20 rounded-2xl p-5 mb-6 text-center">
          <p className="text-xs text-amber-500/60 uppercase tracking-widest mb-1">
            Asked by {currentAskerName}
          </p>
          <p className="text-lg font-semibold text-white leading-snug">{room?.currentQuestion}</p>
        </div>

        {/* Countdown bar */}
        {revealCountdown !== null && (
          <div className="w-full mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-purple-400">All voted! Revealing in…</span>
              <span className="text-lg font-black text-purple-300">{revealCountdown}s</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-100"
                style={{ width: `${(revealCountdown / 5) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="w-full grid grid-cols-3 gap-6 mb-6 place-items-center sm:grid-cols-4">
          {players.map((p, idx) => {
            const pVote = votes.find((v) => v.playerId === p.id);
            const isSelf = p.id === playerId;
            const isThisAsker = p.id === currentAskerId;
            if (isThisAsker) {
              return (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <span className="text-xs text-amber-400 font-semibold">🎤 {p.name}</span>
                  <div className="w-[70px] h-[70px] rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                    <span className="text-xl">🎤</span>
                  </div>
                  <span className="text-xs text-amber-500/60">asked</span>
                </div>
              );
            }
            return (
              <CoinCard
                key={p.id}
                playerName={`#${idx + 1} ${p.name}`}
                playerIndex={idx}
                hasVoted={!!pVote}
                vote={isSelf && pVote ? pVote.vote : null}
                revealed={false}
                isSelf={isSelf}
                onVote={castVote}
                disabled={!!myVote || isAsker}
              />
            );
          })}
        </div>

        <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-400">{votedCount} / {eligibleVoters.length} voted</span>
          <div className="flex gap-1">
            {eligibleVoters.map((p) => (
              <div key={p.id} className={`w-2 h-2 rounded-full transition-all ${votes.find((v) => v.playerId === p.id) ? "bg-amber-400" : "bg-slate-700"}`} />
            ))}
          </div>
        </div>

        {isAsker && (
          <p className="text-slate-500 text-xs text-center mt-4 animate-pulse-slow">
            You asked — waiting for everyone to vote…
          </p>
        )}
      </main>
    );
  }

  // ── REVEAL ───────────────────────────────────────────────────────────────────
  if (phase === "reveal") {
    const nextIdx = (currentAskerIndex + 1) % playerOrder.length;
    const nextAskerName = room?.players[playerOrder[nextIdx]]?.name ?? "";

    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-8 max-w-2xl mx-auto">
        <div className="w-full flex items-center justify-between mb-6">
          <RoomCodeDisplay />
          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">Reveal!</span>
        </div>

        <div className="w-full bg-white/5 border border-purple-500/20 rounded-2xl p-5 mb-6 text-center">
          <p className="text-xs text-purple-400/60 uppercase tracking-widest mb-1">Asked by {currentAskerName}</p>
          <p className="text-lg font-semibold text-white leading-snug">{room?.currentQuestion}</p>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex-1 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-center glow-yes">
            <p className="text-3xl font-black text-green-400">{yesCount}</p>
            <p className="text-xs text-green-500/70 uppercase tracking-wider mt-0.5">Yes</p>
          </div>
          <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-center glow-no">
            <p className="text-3xl font-black text-red-400">{noCount}</p>
            <p className="text-xs text-red-500/70 uppercase tracking-wider mt-0.5">No</p>
          </div>
        </div>

        <div className="w-full grid grid-cols-4 gap-4 mb-6 place-items-center sm:grid-cols-5">
          {[...votes].sort(() => Math.random() - 0.5).map((v, idx) => (
            <AnonymousCoin key={v.playerId} vote={v.vote} index={idx} />
          ))}
        </div>

        {yesCount !== noCount && (
          <div className={`animate-fade-in-scale text-lg font-black px-6 py-3 rounded-2xl mb-4 ${yesCount > noCount ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30"}`}>
            {yesCount > noCount ? "✓ The group said YES!" : "✗ The group said NO!"}
          </div>
        )}
        {yesCount === noCount && yesCount > 0 && (
          <div className="animate-fade-in-scale text-lg font-black px-6 py-3 rounded-2xl mb-4 bg-amber-500/20 text-amber-300 border border-amber-500/30">
            🤝 It&apos;s a tie!
          </div>
        )}

        <p className="text-slate-500 text-sm mb-4">
          Next up: <span className="text-amber-300 font-semibold">{nextAskerName}</span> asks
        </p>

        <button
          onClick={nextRound}
          disabled={actionLoading}
          className="w-full max-w-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-all active:scale-95"
        >
          Next Round →
        </button>
      </main>
    );
  }

  return null;
}
