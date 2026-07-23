import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchGameSnapshot, submitAction, submitForfeit, submitTimeoutCheck } from '../game-sync/api';
import { dbToGameState } from '../game-sync/mapping';
import { createGameChannel } from '../game-sync/realtime';
import { getClientId } from '../lib/identity';
import { supabase } from '../lib/supabaseClient';
import type { GamePlayerRow, RoomRow } from '../lobby/types';

const TIMEOUT_CHECK_INTERVAL_MS = 2000;

export function useSyncedGame(roomId: string) {
  const clientId = useMemo(() => getClientId(), []);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [dbPlayers, setDbPlayers] = useState<GamePlayerRow[]>([]);
  const [state, setState] = useState<ReturnType<typeof dbToGameState> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const snapshot = await fetchGameSnapshot(roomId);
      setRoom(snapshot.room);
      setDbPlayers(snapshot.players);
      setState(dbToGameState(snapshot.room, snapshot.players, snapshot.ownerships));
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    refresh();
    const channel = createGameChannel(roomId, refresh);
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, refresh]);

  const myPlayerId = dbPlayers.find((p) => p.client_id === clientId)?.id ?? null;
  const isMyTurn = state !== null && myPlayerId !== null && state.players[state.currentPlayerIndex].id === myPlayerId;
  const myPlayer = state?.players.find((p) => p.id === myPlayerId) ?? null;
  const isEliminated = myPlayer?.isBankrupt ?? false;

  const runSubmission = useCallback(
    async (request: () => Promise<void>) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      try {
        await request();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        await refresh();
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [refresh],
  );

  const submit = useCallback(
    (action: Parameters<typeof submitAction>[1]) => runSubmission(() => submitAction(roomId, action)),
    [roomId, runSubmission],
  );

  const rollDice = useCallback(() => submit({ type: 'ROLL_DICE' }), [submit]);
  const decidePurchase = useCallback((buy: boolean) => submit({ type: 'DECIDE_PURCHASE', buy }), [submit]);
  const decideBuild = useCallback((build: boolean) => submit({ type: 'DECIDE_BUILD', build }), [submit]);
  const decideInitialBuild = useCallback(
    (targetLevel: number) => submit({ type: 'DECIDE_INITIAL_BUILD', targetLevel }),
    [submit],
  );
  const decideStartBonusBuild = useCallback(
    (tileIdx: number | null) => submit({ type: 'DECIDE_START_BONUS_BUILD', tileIdx }),
    [submit],
  );
  const decideSpaceTravel = useCallback(
    (tileIdx: number | null) => submit({ type: 'DECIDE_SPACE_TRAVEL', tileIdx }),
    [submit],
  );
  const forfeit = useCallback(
    () => runSubmission(() => submitForfeit(roomId)),
    [roomId, runSubmission],
  );

  // 턴 타이머 자동 진행: 방에 접속한 아무 클라이언트나 시간 초과를 감지해 대신 행동한다.
  useEffect(() => {
    const interval = setInterval(() => {
      if (isSubmittingRef.current || !room || !state || state.phase === 'game-over') return;

      const elapsedSec = (Date.now() - new Date(room.turn_started_at ?? 0).getTime()) / 1000;
      if (elapsedSec < room.turn_time_sec) return;

      // 실제 시간 초과 여부/선점/자동행동은 Edge Function이 서버에서 다시 확인하고 처리한다.
      // 여기서는 "임박했나" 가벼운 사전 체크만 해서 불필요한 호출을 줄인다.
      submitTimeoutCheck(roomId)
        .then(() => refresh())
        .catch((err) => console.error('턴 자동 진행 실패:', err));
    }, TIMEOUT_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [roomId, room, state, refresh]);

  const turnDeadlineMs =
    room?.turn_started_at != null
      ? new Date(room.turn_started_at).getTime() + room.turn_time_sec * 1000
      : null;

  return {
    state,
    dbPlayers,
    loading,
    error,
    isMyTurn,
    isEliminated,
    isSubmitting,
    turnDeadlineMs,
    turnTimeSec: room?.turn_time_sec ?? null,
    rollDice,
    decidePurchase,
    decideBuild,
    decideInitialBuild,
    decideStartBonusBuild,
    decideSpaceTravel,
    forfeit,
  };
}
