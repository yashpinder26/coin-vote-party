import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

export const ADMIN_EMAIL = "yashpindersaini@gmail.com";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateRoomCode(): string {
  return Array.from(
    { length: 4 },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  ).join("");
}

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  // Use Firebase Auth UID as player ID when signed in
  if (auth.currentUser) return auth.currentUser.uid;
  let id = localStorage.getItem("coin_vote_player_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("coin_vote_player_id", id);
  }
  return id;
}
