import type { PlayerColor } from '../game/types.ts';

export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type GamePhase = 'awaiting-roll' | 'awaiting-purchase-decision' | 'game-over';

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
  phase: GamePhase;
  last_roll_d1: number | null;
  last_roll_d2: number | null;
  is_double_roll: boolean;
  pending_purchase_tile_idx: number | null;
  winner_player_id: string | null;
  notice: string | null;
  version: number;
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

/** players 테이블 전체 컬럼 (게임 진행 중 상태까지 포함) */
export interface GamePlayerRow {
  id: string;
  room_id: string;
  client_id: string;
  nickname: string;
  color: PlayerColor;
  seat_order: number;
  position: number;
  balance: number;
  is_bankrupt: boolean;
  skip_next_turn: boolean;
}

export interface OwnershipRow {
  id: string;
  room_id: string;
  tile_idx: number;
  player_id: string;
  level: number;
}
