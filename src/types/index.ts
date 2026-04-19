export type RoomStatus = "lobby" | "voting" | "reveal";

export interface Room {
  id: string;
  code: string;
  host_player_id: string;
  status: RoomStatus;
  current_question: string | null;
  round: number;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  is_host: boolean;
  connected: boolean;
  created_at: string;
}

export interface Vote {
  id: string;
  room_id: string;
  player_id: string;
  vote: boolean;
  round: number;
  created_at: string;
}
