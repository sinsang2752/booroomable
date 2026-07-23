import { MAX_PLAYERS, PLAYER_COLORS } from '../game/config';
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
    const { count, error: countError } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);
    if (countError) throw countError;

    if ((count ?? 0) >= MAX_PLAYERS) {
      throw new LobbyError('방이 가득 찼습니다.');
    }

    const seatOrder = count ?? 0;
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

export async function startGame(roomId: string): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ status: 'playing', turn_number: 1, turn_started_at: new Date().toISOString() })
    .eq('id', roomId);
  if (error) throw error;
}

/** 새로고침/재실행 후에도 아직 시작하지 않은 내 방이 있으면 찾아서 돌려준다. */
export async function findActiveLobbyForClient(): Promise<{
  room: RoomRow;
  player: LobbyPlayer;
} | null> {
  const clientId = getClientId();

  const { data, error } = await supabase
    .from('players')
    .select('*, rooms!inner(*)')
    .eq('client_id', clientId)
    .eq('rooms.status', 'waiting')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { rooms, ...player } = data as LobbyPlayer & { rooms: RoomRow };
  return { room: rooms, player: player as LobbyPlayer };
}
