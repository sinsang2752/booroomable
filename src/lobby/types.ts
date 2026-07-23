import type { PlayerColor } from '../game/types';

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface RoomRow {
  id: string;
  code: string;
  status: RoomStatus;
  turn_time_sec: number;
  current_player_id: string | null;
  turn_number: number;
  turn_started_at: string | null;
  host_client_id: string;
  created_at: string;
}

export interface LobbyPlayer {
  id: string;
  room_id: string;
  client_id: string;
  nickname: string;
  color: PlayerColor;
  seat_order: number;
  is_ready: boolean;
  created_at: string;
}
