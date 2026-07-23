import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { gameReducer } from '../../../src/game/engine.ts';
import { START_TILE_IDX, STARTING_BALANCE } from '../../../src/game/config.ts';
import type { GameAction, GameState } from '../../../src/game/types.ts';
import { computePatches, dbToGameState } from '../../../src/game-sync/mapping.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fetchSnapshot(supabase: SupabaseClient, roomId: string) {
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
    room: roomResult.data,
    players: playersResult.data ?? [],
    ownerships: ownershipsResult.data ?? [],
  };
}

/** version을 조건부로 먼저 올려서 "이번 요청을 내가 처리한다"를 선점한다. 1행이면 성공. */
async function claimVersion(
  supabase: SupabaseClient,
  roomId: string,
  expectedVersion: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('rooms')
    .update({ version: expectedVersion + 1 })
    .eq('id', roomId)
    .eq('version', expectedVersion)
    .select();
  if (error) throw error;
  return !!data && data.length === 1;
}

/** players/ownerships를 먼저 쓰고, 방금 선점한 version을 조건으로 rooms를 마지막에 쓴다. */
async function applyPatches(
  supabase: SupabaseClient,
  roomId: string,
  oldState: GameState,
  newState: GameState,
  claimedVersion: number,
): Promise<void> {
  const { roomPatch, playerPatches, ownershipUpserts, ownershipDeletions } = computePatches(oldState, newState);

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

  if (ownershipUpserts.length > 0) {
    const { error } = await supabase.from('ownerships').upsert(
      ownershipUpserts.map((patch) => ({
        room_id: roomId,
        tile_idx: patch.tile_idx,
        player_id: patch.player_id,
        level: patch.level,
      })),
      { onConflict: 'room_id,tile_idx' },
    );
    if (error) throw error;
  }

  if (ownershipDeletions.length > 0) {
    const { error } = await supabase
      .from('ownerships')
      .delete()
      .eq('room_id', roomId)
      .in('tile_idx', ownershipDeletions);
    if (error) throw error;
  }

  const { data: updatedRooms, error: roomError } = await supabase
    .from('rooms')
    .update({ ...roomPatch, turn_started_at: new Date().toISOString(), version: claimedVersion + 1 })
    .eq('id', roomId)
    .eq('version', claimedVersion)
    .select();
  if (roomError) throw roomError;
  if (!updatedRooms || updatedRooms.length === 0) {
    throw new Error('충돌: 다른 요청이 먼저 처리되었습니다.');
  }
}

async function handleStartGame(supabase: SupabaseClient, roomId: string, clientId: string) {
  const { data: room, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  if (error || !room) return jsonResponse({ error: '방을 찾을 수 없습니다.' }, 404);
  if (room.host_client_id !== clientId) {
    return jsonResponse({ error: '방장만 시작할 수 있습니다.' }, 403);
  }
  if (room.status !== 'waiting') {
    return jsonResponse({ error: '이미 시작된 방입니다.' }, 409);
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .order('seat_order', { ascending: true });
  if (playersError) return jsonResponse({ error: playersError.message }, 500);

  const firstPlayer = players?.[0];
  if (!firstPlayer) return jsonResponse({ error: '참가자가 없습니다.' }, 400);

  const { error: resetError } = await supabase
    .from('players')
    .update({
      balance: STARTING_BALANCE,
      position: START_TILE_IDX,
      is_bankrupt: false,
      skip_next_turn: false,
    })
    .eq('room_id', roomId);
  if (resetError) return jsonResponse({ error: resetError.message }, 500);

  const { data: updatedRooms, error: roomError } = await supabase
    .from('rooms')
    .update({
      status: 'playing',
      phase: 'awaiting-roll',
      current_player_id: firstPlayer.id,
      turn_number: 1,
      turn_started_at: new Date().toISOString(),
      last_roll_d1: null,
      last_roll_d2: null,
      is_double_roll: false,
      pending_purchase_tile_idx: null,
      event_deck: [],
      welfare_pool: 0,
      winner_player_id: null,
      notice: null,
      version: 0,
    })
    .eq('id', roomId)
    .eq('status', 'waiting')
    .select();
  if (roomError) return jsonResponse({ error: roomError.message }, 500);
  if (!updatedRooms || updatedRooms.length === 0) {
    return jsonResponse({ error: '이미 시작된 방입니다.' }, 409);
  }

  return jsonResponse({ ok: true });
}

async function handleRollOrPurchase(
  supabase: SupabaseClient,
  roomId: string,
  clientId: string,
  action: GameAction,
) {
  const snapshot = await fetchSnapshot(supabase, roomId);
  if (snapshot.room.status !== 'playing') {
    return jsonResponse({ error: '게임이 진행 중이 아닙니다.' }, 409);
  }

  const callerPlayer = snapshot.players.find((p) => p.client_id === clientId);
  if (!callerPlayer) return jsonResponse({ error: '이 방의 참가자가 아닙니다.' }, 403);

  const oldState = dbToGameState(snapshot.room, snapshot.players, snapshot.ownerships);
  if (oldState.players[oldState.currentPlayerIndex].id !== callerPlayer.id) {
    return jsonResponse({ error: '지금 당신의 턴이 아닙니다.' }, 403);
  }

  const claimed = await claimVersion(supabase, roomId, snapshot.room.version);
  if (!claimed) return jsonResponse({ error: '다른 요청이 먼저 처리되었습니다.' }, 409);

  const newState = gameReducer(oldState, action);
  await applyPatches(supabase, roomId, oldState, newState, snapshot.room.version + 1);
  return jsonResponse({ ok: true });
}

async function handleClaimTimeout(supabase: SupabaseClient, roomId: string) {
  const snapshot = await fetchSnapshot(supabase, roomId);
  if (snapshot.room.status !== 'playing') {
    return jsonResponse({ ok: false, reason: 'not-playing' });
  }

  const oldState = dbToGameState(snapshot.room, snapshot.players, snapshot.ownerships);
  if (oldState.phase === 'game-over') {
    return jsonResponse({ ok: false, reason: 'game-over' });
  }

  const elapsedMs = Date.now() - new Date(snapshot.room.turn_started_at).getTime();
  if (elapsedMs < snapshot.room.turn_time_sec * 1000) {
    return jsonResponse({ ok: false, reason: 'not-yet' });
  }

  const claimed = await claimVersion(supabase, roomId, snapshot.room.version);
  if (!claimed) return jsonResponse({ ok: false, reason: 'already-claimed' });

  const autoAction: GameAction =
    oldState.phase === 'awaiting-purchase-decision'
      ? { type: 'DECIDE_PURCHASE', buy: false }
      : oldState.phase === 'awaiting-build-decision' || oldState.phase === 'awaiting-initial-build-decision'
        ? { type: 'DECIDE_BUILD', build: false }
        : oldState.phase === 'awaiting-start-bonus-build'
          ? { type: 'DECIDE_START_BONUS_BUILD', tileIdx: null }
          : { type: 'ROLL_DICE' };

  const newState = gameReducer(oldState, autoAction);
  await applyPatches(supabase, roomId, oldState, newState, snapshot.room.version + 1);
  return jsonResponse({ ok: true });
}

async function handleForfeit(supabase: SupabaseClient, roomId: string, clientId: string) {
  const snapshot = await fetchSnapshot(supabase, roomId);
  if (snapshot.room.status !== 'playing') {
    return jsonResponse({ error: '게임이 진행 중이 아닙니다.' }, 409);
  }

  const callerPlayer = snapshot.players.find((p) => p.client_id === clientId);
  if (!callerPlayer) return jsonResponse({ error: '이 방의 참가자가 아닙니다.' }, 403);
  if (callerPlayer.is_bankrupt) {
    return jsonResponse({ error: '이미 탈락한 상태입니다.' }, 409);
  }

  const oldState = dbToGameState(snapshot.room, snapshot.players, snapshot.ownerships);

  const claimed = await claimVersion(supabase, roomId, snapshot.room.version);
  if (!claimed) return jsonResponse({ error: '다른 요청이 먼저 처리되었습니다.' }, 409);

  const newState = gameReducer(oldState, { type: 'FORFEIT', playerId: callerPlayer.id });
  await applyPatches(supabase, roomId, oldState, newState, snapshot.room.version + 1);
  return jsonResponse({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { roomId, clientId, type } = body ?? {};

    if (!roomId || !type) {
      return jsonResponse({ error: 'roomId/type이 필요합니다.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: '서버 설정 오류 (서비스 키 없음)' }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    switch (type) {
      case 'START_GAME':
        if (!clientId) return jsonResponse({ error: 'clientId가 필요합니다.' }, 400);
        return await handleStartGame(supabase, roomId, clientId);
      case 'ROLL_DICE':
        if (!clientId) return jsonResponse({ error: 'clientId가 필요합니다.' }, 400);
        return await handleRollOrPurchase(supabase, roomId, clientId, { type: 'ROLL_DICE' });
      case 'DECIDE_PURCHASE':
        if (!clientId) return jsonResponse({ error: 'clientId가 필요합니다.' }, 400);
        return await handleRollOrPurchase(supabase, roomId, clientId, {
          type: 'DECIDE_PURCHASE',
          buy: !!body.buy,
        });
      case 'DECIDE_BUILD':
        if (!clientId) return jsonResponse({ error: 'clientId가 필요합니다.' }, 400);
        return await handleRollOrPurchase(supabase, roomId, clientId, {
          type: 'DECIDE_BUILD',
          build: !!body.build,
        });
      case 'DECIDE_START_BONUS_BUILD':
        if (!clientId) return jsonResponse({ error: 'clientId가 필요합니다.' }, 400);
        return await handleRollOrPurchase(supabase, roomId, clientId, {
          type: 'DECIDE_START_BONUS_BUILD',
          tileIdx: typeof body.tileIdx === 'number' ? body.tileIdx : null,
        });
      case 'CLAIM_TIMEOUT':
        return await handleClaimTimeout(supabase, roomId);
      case 'FORFEIT':
        if (!clientId) return jsonResponse({ error: 'clientId가 필요합니다.' }, 400);
        return await handleForfeit(supabase, roomId, clientId);
      default:
        return jsonResponse({ error: `알 수 없는 type: ${type}` }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
