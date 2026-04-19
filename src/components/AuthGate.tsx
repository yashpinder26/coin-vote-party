"use client";

import { useEffect, useState } from "react";
import { ref, get, set } from "firebase/database";
import { db } from "@/lib/firebase";

const SESSION_KEY = "coin_vote_session";

interface Session {
  username: string;
  displayName: string;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) setSession(JSON.parse(stored));
    } catch {}
    setChecking(false);
  }, []);

  async function signUp() {
    if (!displayName.trim() || !username.trim() || !password || !inviteCode.trim()) {
      setError("Fill in all fields"); return;
    }
    if (!/^[a-z0-9_]+$/.test(username.toLowerCase())) {
      setError("Username: letters, numbers, underscores only"); return;
    }
    setLoading(true);

    // Check invite code from Firebase
    const codeSnap = await get(ref(db, "config/inviteCode"));
    const validCode: string = codeSnap.exists() ? codeSnap.val() : (process.env.NEXT_PUBLIC_INVITE_CODE ?? "PARTY");
    if (inviteCode.trim().toUpperCase() !== validCode.toUpperCase()) {
      setError("Wrong invite code — ask the host"); setLoading(false); return;
    }

    const userRef = ref(db, `users/${username.toLowerCase()}`);
    const snap = await get(userRef);
    if (snap.exists()) {
      setError("Username already taken"); setLoading(false); return;
    }

    await set(userRef, { displayName: displayName.trim(), password, createdAt: Date.now() });
    const sess: Session = { username: username.toLowerCase(), displayName: displayName.trim() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    localStorage.setItem("coin_vote_player_id", username.toLowerCase());
    setSession(sess);
    setLoading(false);
  }

  async function signIn() {
    if (!username.trim() || !password) { setError("Fill in all fields"); return; }
    setLoading(true);
    const snap = await get(ref(db, `users/${username.toLowerCase()}`));
    if (!snap.exists()) { setError("Account not found"); setLoading(false); return; }
    const data = snap.val();
    if (data.password !== password) { setError("Wrong password"); setLoading(false); return; }
    const sess: Session = { username: username.toLowerCase(), displayName: data.displayName };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    localStorage.setItem("coin_vote_player_id", username.toLowerCase());
    setSession(sess);
    setLoading(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-amber-400 animate-pulse-slow text-lg">Loading…</div>
      </div>
    );
  }

  if (session) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-6xl mb-4">🪙</div>
      <h1 className="text-3xl font-black text-amber-300 mb-1">十円 Coin Vote</h1>
      <p className="text-slate-400 text-sm mb-8">
        {mode === "signin" ? "Sign in to play" : "Create your account"}
      </p>

      <div className="w-full max-w-xs bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3">
        {mode === "signup" && (
          <input
            type="text"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setError(""); }}
            placeholder="Display name (shown in game)"
            maxLength={20}
            className="w-full bg-slate-800 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
          />
        )}
        <input
          type="text"
          value={username}
          onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setError(""); }}
          placeholder="Username"
          maxLength={20}
          autoCapitalize="none"
          className="w-full bg-slate-800 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && (mode === "signin" ? signIn() : signUp())}
          placeholder="Password"
          className="w-full bg-slate-800 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
        />
        {mode === "signup" && (
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => { setInviteCode(e.target.value); setError(""); }}
            placeholder="Invite code (from admin)"
            className="w-full bg-slate-800 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition"
          />
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          onClick={mode === "signin" ? signIn : signUp}
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-all active:scale-95"
        >
          {loading ? "…" : mode === "signin" ? "Sign In" : "Create Account"}
        </button>

        <button
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
          className="text-slate-500 hover:text-slate-300 text-sm text-center transition"
        >
          {mode === "signin" ? "No account yet? Create one →" : "Already have an account? Sign in →"}
        </button>
      </div>
    </div>
  );
}
