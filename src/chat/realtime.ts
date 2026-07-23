import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { ChatMessage } from './types';

/**
 * 로비의 room:{roomId} 채널(Presence/시작 신호)과는 별개의 채팅 전용 채널.
 * 게임 화면에서는 로비 채널이 이미 사라진 상태라 로비/게임 양쪽에서 이걸 각자 붙여 쓴다.
 */
export function createChatChannel(
  roomId: string,
  onMessage: (message: ChatMessage) => void,
): RealtimeChannel {
  const channel = supabase.channel(`room:${roomId}:chat`, {
    config: { broadcast: { self: true } },
  });

  channel
    .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
      onMessage(payload as ChatMessage);
    })
    .subscribe();

  return channel;
}

export function sendChatMessage(channel: RealtimeChannel, message: ChatMessage): void {
  channel.send({ type: 'broadcast', event: 'chat_message', payload: message });
}
