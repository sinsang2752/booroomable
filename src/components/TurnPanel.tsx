import { useEffect, useState } from 'react';
import { BOARD } from '../game/board';
import type { GameState } from '../game/types';

interface TurnPanelProps {
  state: GameState;
  isMyTurn: boolean;
  isSubmitting: boolean;
  turnDeadlineMs: number | null;
  onRoll: () => void;
  onDecide: (buy: boolean) => void;
}

export function TurnPanel({
  state,
  isMyTurn,
  isSubmitting,
  turnDeadlineMs,
  onRoll,
  onDecide,
}: TurnPanelProps) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const pendingTile =
    state.pendingPurchaseTileIdx !== null ? BOARD[state.pendingPurchaseTileIdx] : null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const secondsLeft =
    turnDeadlineMs !== null ? Math.max(0, Math.ceil((turnDeadlineMs - now) / 1000)) : null;

  return (
    <div className="turn-panel">
      <div className="turn-panel-current">
        <span className="turn-panel-name" style={{ color: `var(--color-${currentPlayer.color})` }}>
          {currentPlayer.name}
        </span>
        <span className="turn-panel-turn-number">턴 {state.turnNumber}</span>
        {secondsLeft !== null && <span className="turn-panel-countdown">{secondsLeft}초</span>}
      </div>

      {state.lastRoll && (
        <div className="turn-panel-dice">
          🎲 {state.lastRoll[0]} + {state.lastRoll[1]}
        </div>
      )}

      {state.notice && <p className="turn-panel-notice">{state.notice}</p>}

      {!isMyTurn && (
        <p className="turn-panel-wait">{currentPlayer.name}님 차례입니다. 기다려주세요.</p>
      )}

      {isMyTurn && state.phase === 'awaiting-roll' && (
        <button type="button" className="roll-button" onClick={onRoll} disabled={isSubmitting}>
          주사위 굴리기
        </button>
      )}

      {isMyTurn && state.phase === 'awaiting-purchase-decision' && pendingTile && (
        <div className="purchase-prompt">
          <button type="button" onClick={() => onDecide(true)} disabled={isSubmitting}>
            구매 ({pendingTile.price})
          </button>
          <button type="button" onClick={() => onDecide(false)} disabled={isSubmitting}>
            패스
          </button>
        </div>
      )}

      <ul className="turn-panel-players">
        {state.players.map((p) => (
          <li
            key={p.id}
            className={p.id === currentPlayer.id ? 'active' : ''}
            style={{ borderColor: `var(--color-${p.color})` }}
          >
            <span>{p.name}</span>
            <span>{p.isBankrupt ? '파산' : p.balance}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
