"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, onValue, update } from "firebase/database";
import { auth, db, ADMIN_EMAIL } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface UserEntry {
  uid: string;
  email: string;
  name: string;
  photoURL?: string;
  status: "pending" | "approved" | "denied";
  requestedAt: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserEntry[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u?.email === ADMIN_EMAIL) setIsAdmin(true);
      else if (u) router.push("/");
      else router.push("/");
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!isAdmin) return;
    const usersRef = ref(db, "allowedUsers");
    const unsub = onValue(usersRef, (snap) => {
      if (!snap.exists()) { setUsers([]); return; }
      const data = snap.val() as Record<string, Omit<UserEntry, "uid">>;
      setUsers(
        Object.entries(data)
          .map(([uid, v]) => ({ uid, ...v }))
          .sort((a, b) => b.requestedAt - a.requestedAt)
      );
    });
    return () => unsub();
  }, [isAdmin]);

  async function setStatus(uid: string, status: "approved" | "denied") {
    await update(ref(db, `allowedUsers/${uid}`), { status });
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-amber-400 animate-pulse-slow">Loading…</div></div>;
  }
  if (!isAdmin) return null;

  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");
  const denied = users.filter((u) => u.status === "denied");

  function UserRow({ u, actions }: { u: UserEntry; actions: React.ReactNode }) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {u.photoURL
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={u.photoURL} alt="" className="w-9 h-9 rounded-full" />
            : <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold">{u.name[0]}</div>
          }
          <div>
            <p className="font-semibold text-white text-sm">{u.name}</p>
            <p className="text-xs text-slate-400">{u.email}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">{actions}</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-amber-300">Admin Panel</h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage player access</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push("/")} className="text-xs text-slate-500 hover:text-slate-300 transition">
            ← Game
          </button>
          <button onClick={() => signOut(auth)} className="text-xs text-slate-500 hover:text-slate-300 transition">
            Sign out
          </button>
        </div>
      </div>

      {/* Pending */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-yellow-400 uppercase tracking-widest mb-3">
          ⏳ Pending ({pending.length})
        </h2>
        {pending.length === 0
          ? <p className="text-slate-600 text-sm">No pending requests</p>
          : <div className="flex flex-col gap-2">
              {pending.map((u) => (
                <UserRow key={u.uid} u={u} actions={
                  <>
                    <button onClick={() => setStatus(u.uid, "approved")} className="bg-green-500/20 hover:bg-green-500/40 text-green-400 border border-green-500/40 font-bold px-3 py-1.5 rounded-lg text-xs transition">
                      Approve
                    </button>
                    <button onClick={() => setStatus(u.uid, "denied")} className="bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/40 font-bold px-3 py-1.5 rounded-lg text-xs transition">
                      Deny
                    </button>
                  </>
                } />
              ))}
            </div>
        }
      </section>

      {/* Approved */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-3">
          ✓ Approved ({approved.length})
        </h2>
        {approved.length === 0
          ? <p className="text-slate-600 text-sm">None yet</p>
          : <div className="flex flex-col gap-2">
              {approved.map((u) => (
                <UserRow key={u.uid} u={u} actions={
                  <button onClick={() => setStatus(u.uid, "denied")} className="text-red-400 hover:text-red-300 text-xs border border-red-500/30 px-2 py-1 rounded transition">
                    Revoke
                  </button>
                } />
              ))}
            </div>
        }
      </section>

      {/* Denied */}
      {denied.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-3">
            🚫 Denied ({denied.length})
          </h2>
          <div className="flex flex-col gap-2">
            {denied.map((u) => (
              <UserRow key={u.uid} u={u} actions={
                <button onClick={() => setStatus(u.uid, "approved")} className="text-green-400 hover:text-green-300 text-xs border border-green-500/30 px-2 py-1 rounded transition">
                  Approve
                </button>
              } />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
