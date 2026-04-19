"use client";

import { useEffect, useState } from "react";

const HK_COLORS = [
  { bg: "bg-red-500", border: "border-red-300", pattern: "#ef4444" },
  { bg: "bg-blue-500", border: "border-blue-300", pattern: "#3b82f6" },
  { bg: "bg-emerald-500", border: "border-emerald-300", pattern: "#10b981" },
  { bg: "bg-purple-500", border: "border-purple-300", pattern: "#a855f7" },
  { bg: "bg-orange-500", border: "border-orange-300", pattern: "#f97316" },
  { bg: "bg-pink-500", border: "border-pink-300", pattern: "#ec4899" },
  { bg: "bg-cyan-500", border: "border-cyan-300", pattern: "#06b6d4" },
  { bg: "bg-yellow-500", border: "border-yellow-300", pattern: "#eab308" },
];

interface CoinCardProps {
  playerName: string;
  playerIndex: number;
  hasVoted: boolean;
  vote: boolean | null;       // null = unknown / covered
  revealed: boolean;          // whether reveal animation should play
  isSelf: boolean;
  onVote?: (vote: boolean) => void;
  disabled?: boolean;
}

export default function CoinCard({
  playerName,
  playerIndex,
  hasVoted,
  vote,
  revealed,
  isSelf,
  onVote,
  disabled,
}: CoinCardProps) {
  const [flipping, setFlipping] = useState(false);
  const [showHk, setShowHk] = useState(false);
  const [liftHk, setLiftHk] = useState(false);
  const [localVote, setLocalVote] = useState<boolean | null>(null);

  const hk = HK_COLORS[playerIndex % HK_COLORS.length];

  // When this player has voted, show the coin then drop the handkerchief
  useEffect(() => {
    if (hasVoted && (vote !== null || localVote !== null)) {
      setFlipping(true);
      const t1 = setTimeout(() => {
        setFlipping(false);
        setShowHk(true);
      }, 650);
      return () => clearTimeout(t1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVoted]);

  // When reveal triggers, lift the handkerchief
  useEffect(() => {
    if (revealed && showHk) {
      const t = setTimeout(() => setLiftHk(true), playerIndex * 80);
      return () => clearTimeout(t);
    }
    if (!revealed) {
      setLiftHk(false);
    }
  }, [revealed, showHk, playerIndex]);

  // Sync localVote from prop
  useEffect(() => {
    if (vote !== null) setLocalVote(vote);
  }, [vote]);

  function handleVote(v: boolean) {
    if (disabled || hasVoted) return;
    setLocalVote(v);
    onVote?.(v);
  }

  const displayVote = localVote ?? vote;
  const coinFlipped = displayVote === false; // NO = flipped (back side)

  const showRevealedVote = revealed && displayVote !== null;

  return (
    <div className="vote-card">
      {/* Player name */}
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        isSelf ? "bg-amber-500/20 text-amber-300" : "text-slate-400"
      }`}>
        {playerName} {isSelf && "(you)"}
      </span>

      {/* Coin + Handkerchief container */}
      <div className="relative" style={{ width: 90, height: 90 }}>
        {/* Coin */}
        <div className="coin-scene">
          <div className={`coin-inner ${coinFlipped ? "flipped" : ""} ${flipping ? "animate-coin-flip" : ""}`}>
            {/* Front: YES */}
            <div className="coin-face front">
              <span className="text-2xl leading-none">十</span>
              <span className="text-[10px] font-black text-yellow-900 mt-0.5">YES</span>
              <div className="coin-rim" />
            </div>
            {/* Back: NO */}
            <div className="coin-face back">
              <span className="text-2xl leading-none">円</span>
              <span className="text-[10px] font-black text-yellow-900 mt-0.5">NO</span>
              <div className="coin-rim" />
            </div>
          </div>
        </div>

        {/* Handkerchief */}
        {showHk && !liftHk && (
          <div className="handkerchief-wrap">
            <div
              className={`handkerchief animate-hk-drop ${hk.bg}`}
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 10px)`,
                border: `2px solid rgba(255,255,255,0.25)`,
              }}
            />
          </div>
        )}

        {/* Lift animation */}
        {showHk && liftHk && (
          <div className="handkerchief-wrap">
            <div
              className={`handkerchief animate-hk-lift ${hk.bg}`}
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 10px)`,
                border: `2px solid rgba(255,255,255,0.25)`,
              }}
            />
          </div>
        )}

        {/* "?" overlay when hasn't voted and not self */}
        {!hasVoted && !isSelf && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[90px] h-[90px] rounded-full bg-slate-700/60 border border-slate-600 flex items-center justify-center">
              <span className="text-slate-400 text-2xl animate-pulse-slow">?</span>
            </div>
          </div>
        )}
      </div>

      {/* Vote result glow label */}
      {showRevealedVote && (
        <div className={`animate-fade-in-scale text-sm font-black px-3 py-1 rounded-full ${
          displayVote ? "bg-green-500/20 text-green-400 glow-yes" : "bg-red-500/20 text-red-400 glow-no"
        }`}>
          {displayVote ? "✓ YES" : "✗ NO"}
        </div>
      )}

      {/* Own vote buttons */}
      {isSelf && !hasVoted && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => handleVote(true)}
            disabled={disabled}
            className="flex-1 bg-green-500/20 hover:bg-green-500/40 border border-green-500/50 text-green-400 font-bold py-1.5 px-3 rounded-lg text-sm transition-all active:scale-95 disabled:opacity-40"
          >
            YES
          </button>
          <button
            onClick={() => handleVote(false)}
            disabled={disabled}
            className="flex-1 bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 text-red-400 font-bold py-1.5 px-3 rounded-lg text-sm transition-all active:scale-95 disabled:opacity-40"
          >
            NO
          </button>
        </div>
      )}

      {/* Voted indicator (non-self, covered) */}
      {!isSelf && hasVoted && !revealed && (
        <span className="text-slate-500 text-xs">voted</span>
      )}

      {/* Waiting indicator for self */}
      {isSelf && hasVoted && !revealed && (
        <span className="text-amber-500/70 text-xs animate-pulse-slow">waiting for reveal…</span>
      )}
    </div>
  );
}
