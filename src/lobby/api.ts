import { MAX_PLAYERS, PLAYER_COLORS } from '../game/config';
import { extractFunctionErrorMessage } from '../lib/functionsError';
import { getClientId } from '../lib/identity';
import { supabase } from '../lib/supabaseClient';
import { generateRoomCode } from './roomCode';
import type { LobbyPlayer, RoomRow } from './types';

/** 사용자에게 그대로 보여줘도 되는 메시지를 담은 에러 (방 없음/가득 참 등) */
export class LobbyError extends Error {}

const MAX_JOIN_ATTEMPTS = 5;

async function addPlayerToRoom(roomId: string, nickname: string): Promise<LobbyPlayer> {
  const clientId = getClientId();

  const { data: existing, error: existingError } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing as LobbyPlayer;

  for (let attempt = 0; attempt < MAX_JOIN_ATTEMPTS; attempt += 1) {
    const { data: seatRows, error: seatError } = await supabase
      .from('players')
      .select('seat_order')
      .eq('room_id', roomId);
    if (seatError) throw seatError;

    const usedSeats = new Set((seatRows ?? []).map((p) => p.seat_order));
    if (usedSeats.size >= MAX_PLAYERS) {
      throw new LobbyError('방이 가득 찼습니다.');
    }

    // 중간에 나간 사람이 있어도 비어있는 가장 작은 좌석부터 채운다.
    let seatOrder = 0;
    while (usedSeats.has(seatOrder)) seatOrder += 1;

    const { data, error } = await supabase
      .from('players')
      .insert({
        room_id: roomId,
        client_id: clientId,
        nickname,
        seat_order: seatOrder,
        color: PLAYER_COLORS[seatOrder],
      })
      .select()
      .single();

    if (!error) return data as LobbyPlayer;

    if (error.code === '23505' && error.message.includes('players_room_seat_unique')) {
      continue; // 다른 사람이 그 사이 같은 좌석을 가져감 -> 재시도
    }
    if (error.code === '23505' && error.message.includes('players_room_client_unique')) {
      const { data: alreadyJoined, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .eq('client_id', clientId)
        .single();
      if (fetchError) throw fetchError;
      return alreadyJoined as LobbyPlayer;
    }
    throw error;
  }

  throw new LobbyError('참가에 실패했습니다. 다시 시도해주세요.');
}

export async function createRoom(
  nickname: string,
): Promise<{ room: RoomRow; player: LobbyPlayer }> {
  const clientId = getClientId();

  for (let attempt = 0; attempt < MAX_JOIN_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code: generateRoomCode(), host_client_id: clientId })
      .select()
      .single();

    if (!error) {
      const player = await addPlayerToRoom(data.id, nickname);
      return { room: data as RoomRow, player };
    }
    if (error.code === '23505') continue; // 코드 충돌 -> 재생성

    throw error;
  }

  throw new LobbyError('방 생성에 실패했습니다. 다시 시도해주세요.');
}

export async function joinRoomByCode(
  code: string,
  nickname: string,
): Promise<{ room: RoomRow; player: LobbyPlayer }> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();

  if (error) throw error;
  if (!room) throw new LobbyError('방을 찾을 수 없습니다. 코드를 확인해주세요.');
  if (room.status !== 'waiting') throw new LobbyError('이미 시작된 방입니다.');

  const player = await addPlayerToRoom(room.id, nickname);
  return { room: room as RoomRow, player };
}

export async function fetchPlayers(roomId: string): Promise<LobbyPlayer[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .order('seat_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as LobbyPlayer[];
}

export async function fetchRoom(roomId: string): Promise<RoomRow> {
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  if (error) throw error;
  return data as RoomRow;
}

export async function setReady(playerId: string, isReady: boolean): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ is_ready: isReady })
    .eq('id', playerId);
  if (error) throw error;
}

export async function setTurnTimeSec(roomId: string, turnTimeSec: number): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ turn_time_sec: turnTimeSec })
    .eq('id', roomId);
  if (error) throw error;
}

/** 방장이 시작을 누른 순간 호출: 실제 시딩(참가자 초기화 + 방 상태 전환)은
 * Edge Function이 방장인지 확인한 뒤 서버에서 처리한다. */
export async function startGame(roomId: string): Promise<void> {
  const clientId = getClientId();
  const { error } = await supabase.functions.invoke('game-action', {
    body: { roomId, clientId, type: 'START_GAME' },
  });
  if (error) throw new LobbyError(await extractFunctionErrorMessage(error));
}

/** 로비를 나간다. 방장이 나가면 남은 사람 중 가장 먼저 들어온 사람에게 방장을 넘기고,
 * 아무도 안 남으면 방 자체를 지운다. */
export async function leaveRoom(room: RoomRow, player: LobbyPlayer): Promise<void> {
  const { error: deleteError } = await supabase.from('players').delete().eq('id', player.id);
  if (deleteError) throw deleteError;

  if (room.host_client_id !== player.client_id) return;

  const { data: nextHost, error: nextHostError } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', room.id)
    .order('seat_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (nextHostError) throw nextHostError;

  if (nextHost) {
    const { error: updateError } = await supabase
      .from('rooms')
      .update({ host_client_id: nextHost.client_id })
      .eq('id', room.id);
    if (updateError) throw updateError;
  } else {
    const { error: roomDeleteError } = await supabase.from('rooms').delete().eq('id', room.id);
    if (roomDeleteError) throw roomDeleteError;
  }
}

/** 새로고침/재실행 후에도 아직 끝나지 않은(waiting 또는 playing) 내 방이 있으면 찾아서 돌려준다.
 * finished인 방은 제외 — 승리 화면에서 새로고침하면 그냥 메인 화면으로 떨어진다(의도된 단순화). */
export async function findActiveLobbyForClient(): Promise<{
  room: RoomRow;
  player: LobbyPlayer;
} | null> {
  const clientId = getClientId();

  const { data, error } = await supabase
    .from('players')
    .select('*, rooms!inner(*)')
    .eq('client_id', clientId)
    .in('rooms.status', ['waiting', 'playing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { rooms, ...player } = data as LobbyPlayer & { rooms: RoomRow };
  return { room: rooms, player: player as LobbyPlayer };
}
