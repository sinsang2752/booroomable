import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

/**
 * rooms/players/ownerships 중 이 방에 해당하는 변경을 구독한다. 테이블이 작아서
 * 정교하게 patch를 적용하는 대신, 무슨 이벤트든 오면 그냥 전체를 다시 불러온다
 * (useLobby의 refreshLobby와 같은 방식).
 */
export function createGameChannel(roomId: string, onChange: () => void): RealtimeChannel {
  const channel = supabase
    .channel(`room:${roomId}:game`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ownerships', filter: `room_id=eq.${roomId}` },
      () => onChange(),
    )
    .subscribe();

  return channel;
}
