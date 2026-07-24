import type { PlayerColor, TurnPhase } from '../game/types.ts';

export type RoomStatus = 'waiting' | 'playing' | 'finished';
/** game/types.ts의 TurnPhase를 그대로 재사용 — 예전엔 여기 따로 값을 나열해두다가
 * 건물 시스템 phase들이 추가될 때 갱신을 빠뜨려 실제 런타임 값과 어긋난 적이 있어 별칭으로 통일. */
export type GamePhase = TurnPhase;

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
  event_deck: number[] | null;
  welfare_pool: number;
  consecutive_doubles: number;
  roll_seq: number;
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
  jail_turns_left: number;
}

export interface OwnershipRow {
  id: string;
  room_id: string;
  tile_idx: number;
  player_id: string;
  level: number;
}
