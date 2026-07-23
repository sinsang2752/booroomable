import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchPlayers,
  fetchRoom,
  leaveRoom as requestLeaveRoom,
  setReady,
  setTurnTimeSec,
  startGame as requestStartGame,
} from '../lobby/api';
import { createRoomChannel, sendGameStarted, sendLobbyUpdated } from '../lobby/realtime';
import type { LobbyPlayer, RoomRow } from '../lobby/types';
import { getClientId } from '../lib/identity';
import { supabase } from '../lib/supabaseClient';

export function useLobby(roomId: string, onGameStart: () => void) {
  const clientId = useMemo(() => getClientId(), []);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onGameStartRef = useRef(onGameStart);
  onGameStartRef.current = onGameStart;
  const startedRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const refreshLobby = useCallback(async () => {
    try {
      const [freshRoom, freshPlayers] = await Promise.all([fetchRoom(roomId), fetchPlayers(roomId)]);
      setRoom(freshRoom);
      setPlayers(freshPlayers);
      setLoading(false);

      if (freshRoom.status === 'playing' && !startedRef.current) {
        startedRef.current = true;
        onGameStartRef.current();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    refreshLobby();

    const channel = createRoomChannel(roomId, clientId, {
      onLobbyUpdated: refreshLobby,
      onGameStarted: () => {
        if (startedRef.current) return;
        startedRef.current = true;
        onGameStartRef.current();
      },
    });
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId, clientId, refreshLobby]);

  const myPlayer = players.find((p) => p.client_id === clientId) ?? null;
  const isHost = room?.host_client_id === clientId;

  const toggleReady = useCallback(async () => {
    if (!myPlayer) return;
    await setReady(myPlayer.id, !myPlayer.is_ready);
    await refreshLobby();
    if (channelRef.current) sendLobbyUpdated(channelRef.current);
  }, [myPlayer, refreshLobby]);

  const setTurnTime = useCallback(
    async (sec: number) => {
      if (!room) return;
      await setTurnTimeSec(room.id, sec);
      await refreshLobby();
      if (channelRef.current) sendLobbyUpdated(channelRef.current);
    },
    [room, refreshLobby],
  );

  const startGame = useCallback(async () => {
    if (!room) return;
    await requestStartGame(room.id, players);
    if (channelRef.current) sendGameStarted(channelRef.current);
    if (!startedRef.current) {
      startedRef.current = true;
      onGameStartRef.current();
    }
  }, [room, players]);

  const leaveRoom = useCallback(async () => {
    if (!room || !myPlayer) return;
    await requestLeaveRoom(room, myPlayer);
    if (channelRef.current) sendLobbyUpdated(channelRef.current);
  }, [room, myPlayer]);

  return {
    loading,
    room,
    players,
    myPlayer,
    isHost,
    error,
    toggleReady,
    setTurnTime,
    startGame,
    leaveRoom,
  };
}
