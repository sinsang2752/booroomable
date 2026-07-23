import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface RoomChannelHandlers {
  /** 참가자 목록이 바뀌었을 수도 있으니 다시 불러오라는 신호 (Presence 이벤트 + 명시적 브로드캐스트) */
  onLobbyUpdated: () => void;
  /** 방장이 게임을 시작했다는 신호. 실제 게임 상태는 DB에서 다시 읽어오므로 payload는 없음. */
  onGameStarted: () => void;
}

/** 방 하나당 채널 하나. Presence(접속 상태)와 Broadcast(변경 알림/시작 신호)를 함께 쓴다. */
export function createRoomChannel(
  roomId: string,
  clientId: string,
  handlers: RoomChannelHandlers,
): RealtimeChannel {
  const channel = supabase.channel(`room:${roomId}`, {
    config: { presence: { key: clientId } },
  });

  channel
    .on('presence', { event: 'sync' }, () => handlers.onLobbyUpdated())
    .on('presence', { event: 'join' }, () => handlers.onLobbyUpdated())
    .on('presence', { event: 'leave' }, () => handlers.onLobbyUpdated())
    .on('broadcast', { event: 'lobby_updated' }, () => handlers.onLobbyUpdated())
    .on('broadcast', { event: 'game_started' }, () => handlers.onGameStarted())
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({});
      }
    });

  return channel;
}

export function sendLobbyUpdated(channel: RealtimeChannel): void {
  channel.send({ type: 'broadcast', event: 'lobby_updated', payload: {} });
}

export function sendGameStarted(channel: RealtimeChannel): void {
  channel.send({ type: 'broadcast', event: 'game_started', payload: {} });
}
