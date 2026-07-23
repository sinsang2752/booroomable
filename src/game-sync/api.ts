import { gameReducer } from '../game/engine';
import type { GameAction } from '../game/types';
import { supabase } from '../lib/supabaseClient';
import type { GamePlayerRow, OwnershipRow, RoomRow } from '../lobby/types';
import { computePatches, dbToGameState } from './mapping';

export interface GameSnapshot {
  room: RoomRow;
  players: GamePlayerRow[];
  ownerships: OwnershipRow[];
}

export async function fetchGameSnapshot(roomId: string): Promise<GameSnapshot> {
  const [roomResult, playersResult, ownershipsResult] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('seat_order', { ascending: true }),
    supabase.from('ownerships').select('*').eq('room_id', roomId),
  ]);

  if (roomResult.error) throw roomResult.error;
  if (playersResult.error) throw playersResult.error;
  if (ownershipsResult.error) throw ownershipsResult.error;

  return {
    room: roomResult.data as RoomRow,
    players: (playersResult.data ?? []) as GamePlayerRow[],
    ownerships: (ownershipsResult.data ?? []) as OwnershipRow[],
  };
}

/**
 * 최신 스냅샷을 읽어서 engine.ts의 gameReducer를 그대로 실행하고, 결과를 DB에 반영한다.
 * players/ownerships를 먼저 쓰고 rooms를 version 낙관적 락과 함께 마지막에 쓴다 — 자세한 이유는
 * 계획 문서 참고. version이 어긋나면(동시에 다른 요청이 먼저 반영됨) 에러를 던지고, 최신 상태는
 * Postgres Changes 구독으로 곧 들어온다.
 */
export async function submitAction(roomId: string, action: GameAction): Promise<void> {
  const snapshot = await fetchGameSnapshot(roomId);
  const oldState = dbToGameState(snapshot.room, snapshot.players, snapshot.ownerships);
  const newState = gameReducer(oldState, action);
  const { roomPatch, playerPatches, newOwnership } = computePatches(oldState, newState);

  const playerResults = await Promise.all(
    playerPatches.map((patch) =>
      supabase
        .from('players')
        .update({
          position: patch.position,
          balance: patch.balance,
          is_bankrupt: patch.is_bankrupt,
          skip_next_turn: patch.skip_next_turn,
        })
        .eq('id', patch.id),
    ),
  );
  for (const result of playerResults) {
    if (result.error) throw result.error;
  }

  if (newOwnership) {
    const { error: ownershipError } = await supabase.from('ownerships').upsert(
      { room_id: roomId, tile_idx: newOwnership.tile_idx, player_id: newOwnership.player_id },
      { onConflict: 'room_id,tile_idx', ignoreDuplicates: true },
    );
    if (ownershipError) throw ownershipError;
  }

  const { data: updatedRooms, error: roomError } = await supabase
    .from('rooms')
    .update({ ...roomPatch, turn_started_at: new Date().toISOString(), version: snapshot.room.version + 1 })
    .eq('id', roomId)
    .eq('version', snapshot.room.version)
    .select();
  if (roomError) throw roomError;
  if (!updatedRooms || updatedRooms.length === 0) {
    throw new Error('다른 요청이 먼저 처리되었습니다. 최신 상태를 다시 불러옵니다.');
  }
}

/**
 * 턴 타이머가 만료됐을 때, 접속한 여러 클라이언트가 동시에 자동 행동을 시도하지 않도록
 * version을 조건부로 먼저 한 번 올려서 "이번 타임아웃은 내가 처리한다"를 선점한다.
 * 1행이 바뀌면 선점 성공 — 그 다음에 submitAction으로 실제 자동 행동을 제출하면 된다.
 * 0행이면 이미 누군가 처리했거나 상태가 바뀐 것이니 조용히 넘어가면 된다.
 */
export async function claimTurnTimeout(roomId: string, expectedVersion: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('rooms')
    .update({ version: expectedVersion + 1 })
    .eq('id', roomId)
    .eq('version', expectedVersion)
    .select();
  if (error) throw error;
  return !!data && data.length === 1;
}
