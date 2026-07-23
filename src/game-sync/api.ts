import type { GameAction } from '../game/types';
import { extractFunctionErrorMessage } from '../lib/functionsError';
import { getClientId } from '../lib/identity';
import { supabase } from '../lib/supabaseClient';
import type { GamePlayerRow, OwnershipRow, RoomRow } from '../lobby/types';

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

async function invokeGameAction(payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.functions.invoke('game-action', { body: payload });
  if (error) throw new Error(await extractFunctionErrorMessage(error));
}

/** 실제 규칙 계산은 이제 Edge Function(서비스 롤 키)이 하고, 여기서는 요청만 보낸다. */
export async function submitAction(roomId: string, action: GameAction): Promise<void> {
  const clientId = getClientId();
  await invokeGameAction({
    roomId,
    clientId,
    type: action.type,
    ...(action.type === 'DECIDE_PURCHASE' ? { buy: action.buy } : {}),
    ...(action.type === 'DECIDE_BUILD' ? { build: action.build } : {}),
    ...(action.type === 'DECIDE_START_BONUS_BUILD' ? { tileIdx: action.tileIdx } : {}),
  });
}

/** 턴 타이머 만료 여부/선점/자동행동을 전부 Edge Function이 서버에서 재확인하고 처리한다. */
export async function submitTimeoutCheck(roomId: string): Promise<void> {
  await invokeGameAction({ roomId, type: 'CLAIM_TIMEOUT' });
}

/** 게임 포기. 내 턴이 아니어도 언제든 가능 — 서버가 client_id로 내 player 행을 찾아 처리한다. */
export async function submitForfeit(roomId: string): Promise<void> {
  const clientId = getClientId();
  await invokeGameAction({ roomId, clientId, type: 'FORFEIT' });
}
