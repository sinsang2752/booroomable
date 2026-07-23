import { useEffect, useState } from 'react';
import { BOARD } from '../game/board';
import { BUILDING_LEVEL_NAMES, BUILDING_UPGRADE_COST_RATIOS } from '../game/config';
import type { GameState } from '../game/types';

interface TurnPanelProps {
  state: GameState;
  isMyTurn: boolean;
  isEliminated: boolean;
  isSubmitting: boolean;
  turnDeadlineMs: number | null;
  turnTimeSec: number | null;
  onRoll: () => void;
  onDecide: (buy: boolean) => void;
  onDecideBuild: (build: boolean) => void;
  onForfeit: () => void;
}

export function TurnPanel({
  state,
  isMyTurn,
  isEliminated,
  isSubmitting,
  turnDeadlineMs,
  turnTimeSec,
  onRoll,
  onDecide,
  onDecideBuild,
  onForfeit,
}: TurnPanelProps) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const pendingTile =
    state.pendingPurchaseTileIdx !== null ? BOARD[state.pendingPurchaseTileIdx] : null;
  const pendingTileLevel =
    state.pendingPurchaseTileIdx !== null ? state.tileLevels[state.pendingPurchaseTileIdx] : 0;
  const buildCost = pendingTile
    ? Math.round((pendingTile.price ?? 0) * BUILDING_UPGRADE_COST_RATIOS[pendingTileLevel])
    : 0;
  const nextLevelName = BUILDING_LEVEL_NAMES[pendingTileLevel + 1];

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // turn_started_at은 서버(Edge Function) 시계로 찍히는데 여기 now는 브라우저 시계라,
  // 둘 사이 오차(보통 1초 안팎)로 방금 막 시작한 턴이 "31초"처럼 설정값보다 커 보일 수 있다.
  // 실제 자동진행 판정은 서버가 자기 시계로만 하니 정확하고, 여기는 화면 표시만 방어적으로 clamp.
  const secondsLeft =
    turnDeadlineMs !== null
      ? Math.max(0, Math.min(turnTimeSec ?? Infinity, Math.ceil((turnDeadlineMs - now) / 1000)))
      : null;

  function handleForfeitClick() {
    if (window.confirm('정말 게임을 포기하시겠습니까? 포기하면 다시 참여할 수 없습니다.')) {
      onForfeit();
    }
  }

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

      {isMyTurn &&
        (state.phase === 'awaiting-build-decision' ||
          state.phase === 'awaiting-initial-build-decision') &&
        pendingTile && (
        <div className="purchase-prompt">
          <button type="button" onClick={() => onDecideBuild(true)} disabled={isSubmitting}>
            {nextLevelName}(으)로 업그레이드 ({buildCost})
          </button>
          <button type="button" onClick={() => onDecideBuild(false)} disabled={isSubmitting}>
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
            <span>{p.isBankrupt ? '탈락' : p.balance}</span>
          </li>
        ))}
      </ul>

      {!isEliminated && (
        <button type="button" className="forfeit-button" onClick={handleForfeitClick}>
          게임 포기하기
        </button>
      )}
    </div>
  );
}
