import { BOARD_SIZE } from '../game/config.ts';
import type { GameState } from '../game/types.ts';
import type { GamePlayerRow, OwnershipRow, RoomRow } from '../lobby/types.ts';

/** DB 행들(rooms/players/ownerships)로부터 engine.ts가 그대로 쓸 수 있는 GameState를 재구성한다.
 * players는 seat_order 순으로 정렬되어 들어온다고 가정. Player.id는 로컬 포맷("p1") 대신
 * 실제 players.id(uuid)를 그대로 쓴다 — rooms.current_player_id 등 FK와 바로 비교 가능하게. */
export function dbToGameState(
  room: RoomRow,
  players: GamePlayerRow[],
  ownerships: OwnershipRow[],
): GameState {
  const tileOwners: (string | null)[] = Array(BOARD_SIZE).fill(null);
  const tileLevels: number[] = Array(BOARD_SIZE).fill(0);
  for (const ownership of ownerships) {
    tileOwners[ownership.tile_idx] = ownership.player_id;
    tileLevels[ownership.tile_idx] = ownership.level;
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
      jailTurnsLeft: p.jail_turns_left,
    })),
    currentPlayerIndex: currentPlayerIndex === -1 ? 0 : currentPlayerIndex,
    tileOwners,
    tileLevels,
    lastRoll:
      room.last_roll_d1 !== null && room.last_roll_d2 !== null
        ? [room.last_roll_d1, room.last_roll_d2]
        : null,
    isDoubleRoll: room.is_double_roll,
    pendingPurchaseTileIdx: room.pending_purchase_tile_idx,
    eventDeck: room.event_deck ?? [],
    welfarePool: room.welfare_pool,
    consecutiveDoubles: room.consecutive_doubles,
    rollSeq: room.roll_seq ?? 0,
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
  event_deck: number[];
  welfare_pool: number;
  consecutive_doubles: number;
  roll_seq: number;
  winner_player_id: string | null;
  notice: string | null;
}

export interface PlayerPatch {
  id: string;
  position: number;
  balance: number;
  is_bankrupt: boolean;
  jail_turns_left: number;
}

export interface OwnershipPatch {
  tile_idx: number;
  player_id: string;
  level: number;
}

export interface GameStatePatches {
  roomPatch: RoomPatch;
  playerPatches: PlayerPatch[];
  /** 새로 산 땅이거나 레벨이 바뀐 땅 (자동매각으로 여러 칸이 한 번에 바뀔 수 있어 배열) */
  ownershipUpserts: OwnershipPatch[];
  /** 자동매각으로 소유권 자체가 사라진 칸의 tile_idx 목록 */
  ownershipDeletions: number[];
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
    event_deck: newState.eventDeck,
    welfare_pool: newState.welfarePool,
    consecutive_doubles: newState.consecutiveDoubles,
    roll_seq: newState.rollSeq,
    winner_player_id: newState.winnerId,
    notice: newState.notice,
  };

  const playerPatches: PlayerPatch[] = newState.players.map((p) => ({
    id: p.id,
    position: p.position,
    balance: p.balance,
    is_bankrupt: p.isBankrupt,
    jail_turns_left: p.jailTurnsLeft,
  }));

  const ownershipUpserts: OwnershipPatch[] = [];
  const ownershipDeletions: number[] = [];
  for (let idx = 0; idx < newState.tileOwners.length; idx += 1) {
    const oldOwnerId = oldState.tileOwners[idx];
    const newOwnerId = newState.tileOwners[idx];

    if (newOwnerId === null) {
      if (oldOwnerId !== null) {
        ownershipDeletions.push(idx);
      }
      continue;
    }

    const ownerChanged = oldOwnerId !== newOwnerId;
    const levelChanged = oldState.tileLevels[idx] !== newState.tileLevels[idx];
    if (ownerChanged || levelChanged) {
      ownershipUpserts.push({ tile_idx: idx, player_id: newOwnerId, level: newState.tileLevels[idx] });
    }
  }

  return { roomPatch, playerPatches, ownershipUpserts, ownershipDeletions };
}
