"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, getPlayerId } from "@/lib/supabase";
import type { Room, Player, Vote } from "@/types";
import CoinCard from "@/components/CoinCard";

type GamePhase = "loading" | "lobby" | "voting" | "reveal" | "not_found";

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<GamePhase>("loading");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [question, setQuestion] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  const playerId = getPlayerId();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isHost = players.find((p) => p.id === playerId)?.is_host ?? false;
  const myVote = votes.find((v) => v.player_id === playerId && v.round === (room?.round ?? 0));

  // ── Initial load ────────────────────────────────────────────────────────────
  const loadRoom = useCallback(async () => {
    const { data: r } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (!r) { setPhase("not_found"); return; }

    setRoom(r);
    setPhase(r.status as GamePhase);

    const [{ data: ps }, { data: vs }] = await Promise.all([
      supabase.from("players").select("*").eq("room_id", r.id),
      supabase.from("votes").select("*").eq("room_id", r.id).eq("round", r.round),
    ]);

    setPlayers(ps ?? []);
    setVotes(vs ?? []);
  }, [code]);

  // ── Realtime subscription ────────────────────────────────────────────────────
  const subscribeRealtime = useCallback(
    (roomId: string, currentRound: number) => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);

      const ch = supabase
        .channel(`room-${roomId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
          (payload) => {
            const updated = payload.new as Room;
            setRoom(updated);
            setPhase(updated.status as GamePhase);

            // If a new round started, clear old votes from state
            if (updated.round !== currentRound) {
              setVotes([]);
              currentRound = updated.round;
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
          (payload) => {
            const p = payload.new as Player;
            setPlayers((prev) => {
              const idx = prev.findIndex((x) => x.id === p.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = p;
                return next;
              }
              return [...prev, p];
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "votes", filter: `room_id=eq.${roomId}` },
          (payload) => {
            const v = payload.new as Vote;
            setVotes((prev) => {
              if (prev.find((x) => x.id === v.id)) return prev;
              return [...prev, v];
            });
          }
        )
        .subscribe();

      channelRef.current = ch;
    },
    []
  );

  useEffect(() => {
    loadRoom().then(() => {
      // After loadRoom sets room, subscribe
    });
  }, [loadRoom]);

  // Subscribe once room is loaded
  useEffect(() => {
    if (room) subscribeRealtime(room.id, room.round);
  }, [room?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark player connected on mount
  useEffect(() => {
    if (!room) return;
    supabase
      .from("players")
      .update({ connected: true })
      .eq("id", playerId)
      .then(() => {});
  }, [room?.id, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // ── Countdown helper (for reveal drama) ─────────────────────────────────────
  function runCountdown(onDone: () => void) {
    let n = 3;
    setCountdown(n);
    const iv = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(iv);
        setCountdown(null);
        onDone();
      } else {
        setCountdown(n);
      }
    }, 800);
  }

  // ── Host actions ─────────────────────────────────────────────────────────────
  async function startRound() {
    if (!question.trim() || !room) return;
    setActionLoading(true);
    await supabase
      .from("rooms")
      .update({ status: "voting", current_question: question.trim() })
      .eq("id", room.id);
    setQuestion("");
    setActionLoading(false);
  }

  async function revealVotes() {
    if (!room) return;
    runCountdown(async () => {
      await supabase.from("rooms").update({ status: "reveal" }).eq("id", room.id);
    });
  }

  async function nextRound() {
    if (!room) return;
    setActionLoading(true);
    await supabase
      .from("rooms")
      .update({ status: "lobby", current_question: null, round: room.round + 1 })
      .eq("id", room.id);
    setActionLoading(false);
  }

  // ── Player vote ──────────────────────────────────────────────────────────────
  async function castVote(vote: boolean) {
    if (!room || myVote) return;
    await supabase.from("votes").upsert({
      room_id: room.id,
      player_id: playerId,
      vote,
      round: room.round,
    });
  }

  // ── Copy room code ───────────────────────────────────────────────────────────
  function copyCode() {
    navigator.clipboard.writeText(code.toUpperCase()).then(() => {
      setCopyMsg("Copied!");
      setTimeout(() => setCopyMsg(""), 2000);
    });
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const votedCount = votes.filter((v) => v.round === (room?.round ?? 0)).length;
  const eligibleVoters = players.filter((p) => !p.is_host || players.length === 1);
  const allVoted = votedCount >= eligibleVoters.length && eligibleVoters.length > 0;

  const yesCount = votes.filter((v) => v.vote === true && v.round === (room?.round ?? 0)).length;
  const noCount = votes.filter((v) => v.vote === false && v.round === (room?.round ?? 0)).length;

  // ── Render helpers ───────────────────────────────────────────────────────────
  function RoomCodeDisplay() {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {code.toUpperCase().split("").map((ch, i) => (
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

  // ── Loading ──────────────────────────────────────────────────────────────────
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
        <p className="text-slate-400">Room <strong className="text-white">{code.toUpperCase()}</strong> not found.</p>
        <button onClick={() => router.push("/")} className="text-amber-400 hover:underline">
          ← Back to home
        </button>
      </div>
    );
  }

  // ── Countdown overlay ────────────────────────────────────────────────────────
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

        {/* Players list */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">
            Players ({players.length})
          </p>
          <div className="flex flex-col gap-2">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${p.connected ? "bg-green-400" : "bg-slate-600"}`} />
                <span className={`font-medium ${p.id === playerId ? "text-amber-300" : "text-white"}`}>
                  {p.name}
                </span>
                {p.is_host && (
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded ml-auto">
                    host
                  </span>
                )}
                {p.id === playerId && !p.is_host && (
                  <span className="text-xs text-slate-600 ml-auto">you</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Host controls */}
        {isHost ? (
          <div className="w-full flex flex-col gap-3">
            <label className="text-xs text-slate-400 uppercase tracking-widest">
              Ask a yes/no question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Would you rather live in a foreign country?"
              rows={3}
              maxLength={200}
              className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition resize-none"
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
          <p className="text-slate-500 text-sm text-center animate-pulse-slow">
            The host is typing a question…
          </p>
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
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
            Voting
          </span>
        </div>

        {/* Question */}
        <div className="w-full bg-white/5 border border-amber-500/20 rounded-2xl p-5 mb-8 text-center">
          <p className="text-xs text-amber-500/60 uppercase tracking-widest mb-2">Question</p>
          <p className="text-lg font-semibold text-white leading-snug">
            {room?.current_question}
          </p>
        </div>

        {/* Vote grid */}
        <div className="w-full grid grid-cols-3 gap-6 mb-8 place-items-center sm:grid-cols-4">
          {players.map((p, idx) => {
            const pVote = votes.find(
              (v) => v.player_id === p.id && v.round === (room?.round ?? 0)
            );
            const isSelf = p.id === playerId;
            const showVote = isSelf && pVote ? pVote.vote : null;
            return (
              <CoinCard
                key={p.id}
                playerName={p.name}
                playerIndex={idx}
                hasVoted={!!pVote}
                vote={showVote}
                revealed={false}
                isSelf={isSelf}
                onVote={castVote}
                disabled={!!myVote}
              />
            );
          })}
        </div>

        {/* Vote progress */}
        <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {votedCount} / {eligibleVoters.length} voted
          </span>
          <div className="flex gap-1">
            {eligibleVoters.map((p, i) => (
              <div
                key={p.id}
                className={`w-2 h-2 rounded-full transition-all ${
                  votes.find((v) => v.player_id === p.id) ? "bg-amber-400" : "bg-slate-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Host reveal button */}
        {isHost && (
          <button
            onClick={revealVotes}
            disabled={!allVoted && votedCount === 0}
            className="w-full max-w-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-purple-500/20"
          >
            {allVoted ? "🎭 Reveal Votes!" : `Waiting… (${votedCount}/${eligibleVoters.length})`}
          </button>
        )}

        {!isHost && (
          <p className="text-slate-600 text-xs text-center">
            Waiting for host to reveal…
          </p>
        )}
      </main>
    );
  }

  // ── REVEAL ───────────────────────────────────────────────────────────────────
  if (phase === "reveal") {
    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-8 max-w-2xl mx-auto">
        <div className="w-full flex items-center justify-between mb-6">
          <RoomCodeDisplay />
          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
            Reveal!
          </span>
        </div>

        {/* Question */}
        <div className="w-full bg-white/5 border border-purple-500/20 rounded-2xl p-5 mb-6 text-center">
          <p className="text-xs text-purple-400/60 uppercase tracking-widest mb-2">Question</p>
          <p className="text-lg font-semibold text-white leading-snug">
            {room?.current_question}
          </p>
        </div>

        {/* Score summary */}
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

        {/* Reveal grid */}
        <div className="w-full grid grid-cols-3 gap-6 mb-8 place-items-center sm:grid-cols-4">
          {players.map((p, idx) => {
            const pVote = votes.find(
              (v) => v.player_id === p.id && v.round === (room?.round ?? 0)
            );
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

        {/* Majority result */}
        {(yesCount !== noCount) && (
          <div className={`animate-fade-in-scale text-lg font-black px-6 py-3 rounded-2xl mb-6 ${
            yesCount > noCount
              ? "bg-green-500/20 text-green-300 border border-green-500/30"
              : "bg-red-500/20 text-red-300 border border-red-500/30"
          }`}>
            {yesCount > noCount ? "✓ The group said YES!" : "✗ The group said NO!"}
          </div>
        )}
        {yesCount === noCount && yesCount > 0 && (
          <div className="animate-fade-in-scale text-lg font-black px-6 py-3 rounded-2xl mb-6 bg-amber-500/20 text-amber-300 border border-amber-500/30">
            🤝 It&apos;s a tie!
          </div>
        )}

        {/* Next round button (host only) */}
        {isHost && (
          <button
            onClick={nextRound}
            disabled={actionLoading}
            className="w-full max-w-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-all active:scale-95"
          >
            Next Round →
          </button>
        )}
        {!isHost && (
          <p className="text-slate-600 text-xs text-center mt-2">
            Waiting for host to start next round…
          </p>
        )}
      </main>
    );
  }

  return null;
}
