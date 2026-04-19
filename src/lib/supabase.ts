import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    _client = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return _client;
}

// Re-export as `supabase` for convenience — lazily initialized on first call
export const supabase = {
  get from() { return getSupabase().from.bind(getSupabase()); },
  get channel() { return getSupabase().channel.bind(getSupabase()); },
  get removeChannel() { return getSupabase().removeChannel.bind(getSupabase()); },
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateRoomCode(): string {
  return Array.from(
    { length: 4 },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  ).join("");
}

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("coin_vote_player_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("coin_vote_player_id", id);
  }
  return id;
}
