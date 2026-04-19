"use client";

import { useEffect, useState } from "react";

const ACCESS_PIN = process.env.NEXT_PUBLIC_ACCESS_PIN ?? "1234";
const STORAGE_KEY = "coin_vote_access";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === ACCESS_PIN) setUnlocked(true);
    setChecking(false);
  }, []);

  function submit() {
    if (pin === ACCESS_PIN) {
      localStorage.setItem(STORAGE_KEY, ACCESS_PIN);
      setUnlocked(true);
    } else {
      setError("Wrong PIN — ask the host for it");
      setPin("");
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-amber-400 animate-pulse-slow text-lg">Loading…</div>
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-6xl mb-4">🪙</div>
      <h1 className="text-3xl font-black text-amber-300 mb-2">十円 Coin Vote</h1>
      <p className="text-slate-400 text-sm mb-8">Enter the PIN to play</p>
      <div className="w-full max-w-xs bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
        <input
          type="text"
          inputMode="numeric"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="PIN"
          maxLength={20}
          className="w-full bg-slate-800 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-center text-2xl font-mono font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
        />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button
          onClick={submit}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl transition-all active:scale-95"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
