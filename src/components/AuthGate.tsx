"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
} from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { auth, db, ADMIN_EMAIL } from "@/lib/firebase";

type Status = "loading" | "signed_out" | "pending" | "approved" | "denied" | "admin";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setUser(null); setStatus("signed_out"); return; }
      setUser(u);

      if (u.email === ADMIN_EMAIL) { setStatus("admin"); return; }

      const snap = await get(ref(db, `allowedUsers/${u.uid}`));
      if (!snap.exists()) {
        await set(ref(db, `allowedUsers/${u.uid}`), {
          email: u.email ?? "",
          name: u.displayName ?? u.email ?? "Unknown",
          photoURL: u.photoURL ?? "",
          status: "pending",
          requestedAt: Date.now(),
        });
        setStatus("pending");
      } else {
        const s = snap.val().status;
        setStatus(s === "approved" ? "approved" : s === "denied" ? "denied" : "pending");
      }
    });
    return () => unsub();
  }, []);

  async function signIn() {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch {
      // user closed popup
    }
  }

  function handleSignOut() {
    signOut(auth);
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-amber-400 animate-pulse-slow text-lg">Loading…</div>
      </div>
    );
  }

  // ── Not signed in ─────────────────────────────────────────────────────────────
  if (status === "signed_out") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-6xl mb-4">🪙</div>
        <h1 className="text-3xl font-black text-amber-300 mb-2">十円 Coin Vote</h1>
        <p className="text-slate-400 text-sm mb-8">Sign in to play</p>
        <div className="w-full max-w-xs bg-white/5 border border-white/10 rounded-2xl p-6">
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-100 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
          <p className="text-slate-600 text-xs text-center mt-4">
            Access requires admin approval
          </p>
        </div>
      </div>
    );
  }

  // ── Pending approval ──────────────────────────────────────────────────────────
  if (status === "pending") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-4">
        <div className="text-5xl">⏳</div>
        <h2 className="text-xl font-bold text-amber-300">Waiting for approval</h2>
        <p className="text-slate-400 text-sm text-center max-w-xs">
          Your request has been sent to the admin.<br />
          You&apos;ll be able to play once approved.
        </p>
        {user?.photoURL && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full border-2 border-amber-500/30" />
        )}
        <p className="text-slate-500 text-xs">{user?.email}</p>
        <button onClick={handleSignOut} className="text-slate-600 hover:text-slate-400 text-xs mt-2 transition">
          Sign out
        </button>
      </div>
    );
  }

  // ── Denied ────────────────────────────────────────────────────────────────────
  if (status === "denied") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-4">
        <div className="text-5xl">🚫</div>
        <h2 className="text-xl font-bold text-red-400">Access Denied</h2>
        <p className="text-slate-400 text-sm text-center max-w-xs">
          Your request was not approved. Contact the admin if you think this is a mistake.
        </p>
        <button onClick={handleSignOut} className="text-slate-600 hover:text-slate-400 text-xs mt-2 transition">
          Sign out
        </button>
      </div>
    );
  }

  // ── Approved / Admin → show the app ─────────────────────────────────────────
  return <>{children}</>;
}
