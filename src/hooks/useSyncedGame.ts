import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchGameSnapshot, submitAction } from '../game-sync/api';
import { dbToGameState } from '../game-sync/mapping';
import { createGameChannel } from '../game-sync/realtime';
import { getClientId } from '../lib/identity';
import { supabase } from '../lib/supabaseClient';
import type { GamePlayerRow } from '../lobby/types';

export function useSyncedGame(roomId: string) {
  const clientId = useMemo(() => getClientId(), []);
  const [dbPlayers, setDbPlayers] = useState<GamePlayerRow[]>([]);
  const [state, setState] = useState<ReturnType<typeof dbToGameState> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const snapshot = await fetchGameSnapshot(roomId);
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

  const submit = useCallback(
    async (action: Parameters<typeof submitAction>[1]) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        await submitAction(roomId, action);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        await refresh();
        setIsSubmitting(false);
      }
    },
    [roomId, isSubmitting, refresh],
  );

  const rollDice = useCallback(() => submit({ type: 'ROLL_DICE' }), [submit]);
  const decidePurchase = useCallback((buy: boolean) => submit({ type: 'DECIDE_PURCHASE', buy }), [submit]);

  return { state, dbPlayers, loading, error, isMyTurn, isSubmitting, rollDice, decidePurchase };
}
