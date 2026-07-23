import { BOARD_SIZE } from '../game/config';
import type { GameState } from '../game/types';
import type { GamePlayerRow, OwnershipRow, RoomRow } from '../lobby/types';

/** DB 행들(rooms/players/ownerships)로부터 engine.ts가 그대로 쓸 수 있는 GameState를 재구성한다.
 * players는 seat_order 순으로 정렬되어 들어온다고 가정. Player.id는 로컬 포맷("p1") 대신
 * 실제 players.id(uuid)를 그대로 쓴다 — rooms.current_player_id 등 FK와 바로 비교 가능하게. */
export function dbToGameState(
  room: RoomRow,
  players: GamePlayerRow[],
  ownerships: OwnershipRow[],
): GameState {
  const tileOwners: (string | null)[] = Array(BOARD_SIZE).fill(null);
  for (const ownership of ownerships) {
    tileOwners[ownership.tile_idx] = ownership.player_id;
  }

  const currentPlayerIndex = players.findIndex((p) => p.id === room.current_player_id);

  return {
    phase: room.phase,
    players: players.map((p) => ({
      id: p.id,
      name: p.nickname,
      color: p.color,
      seatOrder: p.seat_order,
      position: p.position,
      balance: p.balance,
      isBankrupt: p.is_bankrupt,
      skipNextTurn: p.skip_next_turn,
    })),
    currentPlayerIndex: currentPlayerIndex === -1 ? 0 : currentPlayerIndex,
    tileOwners,
    lastRoll:
      room.last_roll_d1 !== null && room.last_roll_d2 !== null
        ? [room.last_roll_d1, room.last_roll_d2]
        : null,
    isDoubleRoll: room.is_double_roll,
    pendingPurchaseTileIdx: room.pending_purchase_tile_idx,
    winnerId: room.winner_player_id,
    turnNumber: room.turn_number,
    notice: room.notice,
  };
}

export interface RoomPatch {
  phase: GameState['phase'];
  status: 'playing' | 'finished';
  current_player_id: string;
  turn_number: number;
  last_roll_d1: number | null;
  last_roll_d2: number | null;
  is_double_roll: boolean;
  pending_purchase_tile_idx: number | null;
  winner_player_id: string | null;
  notice: string | null;
}

export interface PlayerPatch {
  id: string;
  position: number;
  balance: number;
  is_bankrupt: boolean;
  skip_next_turn: boolean;
}

export interface NewOwnership {
  tile_idx: number;
  player_id: string;
}

export interface GameStatePatches {
  roomPatch: RoomPatch;
  playerPatches: PlayerPatch[];
  newOwnership: NewOwnership | null;
}

/** gameReducer 실행 전/후 GameState를 비교해서 DB에 쓸 값들을 뽑아낸다. */
export function computePatches(oldState: GameState, newState: GameState): GameStatePatches {
  const roomPatch: RoomPatch = {
    phase: newState.phase,
    status: newState.phase === 'game-over' ? 'finished' : 'playing',
    current_player_id: newState.players[newState.currentPlayerIndex].id,
    turn_number: newState.turnNumber,
    last_roll_d1: newState.lastRoll?.[0] ?? null,
    last_roll_d2: newState.lastRoll?.[1] ?? null,
    is_double_roll: newState.isDoubleRoll,
    pending_purchase_tile_idx: newState.pendingPurchaseTileIdx,
    winner_player_id: newState.winnerId,
    notice: newState.notice,
  };

  const playerPatches: PlayerPatch[] = newState.players.map((p) => ({
    id: p.id,
    position: p.position,
    balance: p.balance,
    is_bankrupt: p.isBankrupt,
    skip_next_turn: p.skipNextTurn,
  }));

  let newOwnership: NewOwnership | null = null;
  for (let idx = 0; idx < newState.tileOwners.length; idx += 1) {
    if (oldState.tileOwners[idx] === null && newState.tileOwners[idx] !== null) {
      newOwnership = { tile_idx: idx, player_id: newState.tileOwners[idx] as string };
      break;
    }
  }

  return { roomPatch, playerPatches, newOwnership };
}
