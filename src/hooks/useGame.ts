import { useMemo, useReducer } from 'react';
import { createInitialState, gameReducer } from '../game/engine';

export function useGame(playerNames: string[]) {
  const [state, dispatch] = useReducer(gameReducer, playerNames, createInitialState);

  const actions = useMemo(
    () => ({
      rollDice: () => dispatch({ type: 'ROLL_DICE' }),
      decidePurchase: (buy: boolean) => dispatch({ type: 'DECIDE_PURCHASE', buy }),
    }),
    [],
  );

  return { state, ...actions };
}
