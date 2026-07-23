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

/** 게임 시작 시 로비가 게임 화면에 넘겨주는, seat_order 순 참가자 요약 */
export interface GameRosterEntry {
  clientId: string;
  nickname: string;
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
