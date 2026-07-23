import { useCallback, useEffect, useRef, useState } from 'react';
import { createChatChannel, sendChatMessage } from '../chat/realtime';
import type { ChatMessage } from '../chat/types';
import { supabase } from '../lib/supabaseClient';

const MAX_MESSAGES = 50;
const MAX_BODY_LENGTH = 20;

export function useRoomChat(roomId: string, clientId: string, nickname: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof createChatChannel> | null>(null);

  useEffect(() => {
    const channel = createChatChannel(roomId, (message) => {
      setMessages((prev) => [...prev, message].slice(-MAX_MESSAGES));
    });
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const sendMessage = useCallback(
    (body: string) => {
      const trimmed = body.trim().slice(0, MAX_BODY_LENGTH);
      if (!trimmed || !channelRef.current) return;
      sendChatMessage(channelRef.current, { clientId, nickname, body: trimmed, at: Date.now() });
    },
    [clientId, nickname],
  );

  return { messages, sendMessage };
}
