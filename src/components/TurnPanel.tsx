import { useEffect, useRef, useState } from 'react';
import { BOARD } from '../game/board';
import { getCumulativeUpgradeCost, getMaxAffordableLevel, getUpgradeCost } from '../game/buildings';
import { BUILDING_LEVEL_NAMES } from '../game/config';
import type { GameState } from '../game/types';

interface TurnPanelProps {
  state: GameState;
  isMyTurn: boolean;
  isEliminated: boolean;
  isSubmitting: boolean;
  onRoll: () => void;
  onDecide: (buy: boolean) => void;
  onDecideBuild: (build: boolean) => void;
  onDecideInitialBuild: (targetLevel: number) => void;
  onSkipStartBonusBuild: () => void;
  onSkipSpaceTravel: () => void;
  onForfeit: () => void;
}

type NoticeTone = 'neutral' | 'income' | 'expense' | 'danger' | 'gold';

function classifyNotice(notice: string): NoticeTone {
  if (notice.includes('파산')) return 'danger';
  if (notice.includes('황금열쇠')) return 'gold';
  if (notice.includes('받았습니다') || notice.includes('월급') || notice.includes('수령했습니다')) return 'income';
  if (
    notice.includes('냈습니다') ||
    notice.includes('지불했습니다') ||
    notice.includes('납부했습니다') ||
    notice.includes('매각했습니다')
  ) {
    return 'expense';
  }
  return 'neutral';
}

export function TurnPanel({
  state,
  isMyTurn,
  isEliminated,
  isSubmitting,
  onRoll,
  onDecide,
  onDecideBuild,
  onDecideInitialBuild,
  onSkipStartBonusBuild,
  onSkipSpaceTravel,
  onForfeit,
}: TurnPanelProps) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const pendingIdx = state.pendingPurchaseTileIdx;
  const pendingTile = pendingIdx !== null ? BOARD[pendingIdx] : null;
  const pendingTileLevel = pendingIdx !== null ? state.tileLevels[pendingIdx] : 0;
  const buildCost = pendingIdx !== null ? (getUpgradeCost(pendingIdx, pendingTileLevel) ?? 0) : 0;
  const nextLevelName = BUILDING_LEVEL_NAMES[pendingTileLevel + 1];

  const initialBuildOptions =
    pendingIdx !== null
      ? (() => {
          const maxLevel = getMaxAffordableLevel(pendingIdx, pendingTileLevel, currentPlayer.balance);
          return Array.from({ length: maxLevel - pendingTileLevel }, (_, i) => {
            const level = pendingTileLevel + i + 1;
            return { level, cost: getCumulativeUpgradeCost(pendingIdx, pendingTileLevel, level) };
          });
        })()
      : [];

  // 자산 증감(+/-) 표시: 같은 턴 안에서 현재 턴 플레이어의 잔액이 바뀔 때만 짧게 보여준다.
  const [delta, setDelta] = useState<number | null>(null);
  const baselineRef = useRef<{ turnNumber: number; playerId: string; balance: number } | null>(null);
  useEffect(() => {
    const baseline = baselineRef.current;
    if (!baseline || baseline.turnNumber !== state.turnNumber || baseline.playerId !== currentPlayer.id) {
      baselineRef.current = { turnNumber: state.turnNumber, playerId: currentPlayer.id, balance: currentPlayer.balance };
      setDelta(null);
      return;
    }
    if (baseline.balance === currentPlayer.balance) return;
    const diff = currentPlayer.balance - baseline.balance;
    baselineRef.current = { ...baseline, balance: currentPlayer.balance };
    setDelta(diff);
    const timer = setTimeout(() => setDelta(null), 1800);
    return () => clearTimeout(timer);
  }, [state.turnNumber, currentPlayer.id, currentPlayer.balance]);

  function handleForfeitClick() {
    if (window.confirm('정말 게임을 포기하시겠습니까? 포기하면 다시 참여할 수 없습니다.')) {
      onForfeit();
    }
  }

  const noticeTone = state.notice ? classifyNotice(state.notice) : null;

  return (
    <div className="turn-panel">
      <div className="turn-panel-asset">
        <div className="asset-icon" aria-hidden="true">
          💰
        </div>
        <div className="asset-info">
          <span className="asset-label">{currentPlayer.name}님 자산</span>
          <span className="asset-balance">
            {currentPlayer.balance.toLocaleString()}
            {delta !== null && (
              <span className={`asset-delta ${delta >= 0 ? 'asset-delta--up' : 'asset-delta--down'}`}>
                {delta >= 0 ? '+' : ''}
                {delta.toLocaleString()}
              </span>
            )}
          </span>
        </div>
      </div>

      <p className={`turn-panel-notice${noticeTone ? ` turn-panel-notice--${noticeTone}` : ''}`}>
        {state.notice ?? ''}
      </p>

      <div className="turn-panel-actions">
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
              건너뛰기
            </button>
          </div>
        )}

        {isMyTurn && state.phase === 'awaiting-build-decision' && pendingTile && (
          <div className="purchase-prompt">
            <button type="button" onClick={() => onDecideBuild(true)} disabled={isSubmitting}>
              {nextLevelName}(으)로 업그레이드 ({buildCost})
            </button>
            <button type="button" onClick={() => onDecideBuild(false)} disabled={isSubmitting}>
              건너뛰기
            </button>
          </div>
        )}

        {isMyTurn && state.phase === 'awaiting-initial-build-decision' && pendingTile && (
          <div className="purchase-prompt">
            {initialBuildOptions.map(({ level, cost }) => (
              <button key={level} type="button" onClick={() => onDecideInitialBuild(level)} disabled={isSubmitting}>
                {BUILDING_LEVEL_NAMES[level]} ({cost})
              </button>
            ))}
            <button type="button" onClick={() => onDecideInitialBuild(pendingTileLevel)} disabled={isSubmitting}>
              짓지 않음
            </button>
          </div>
        )}

        {isMyTurn && state.phase === 'awaiting-start-bonus-build' && (
          <div className="purchase-prompt">
            <p className="turn-panel-wait">보드에서 업그레이드할 땅을 골라주세요.</p>
            <button type="button" onClick={onSkipStartBonusBuild} disabled={isSubmitting}>
              건너뛰기
            </button>
          </div>
        )}

        {isMyTurn && state.phase === 'awaiting-space-travel-destination' && (
          <div className="purchase-prompt">
            <p className="turn-panel-wait">보드에서 이동할 칸을 골라주세요.</p>
            <button type="button" onClick={onSkipSpaceTravel} disabled={isSubmitting}>
              이동 안 함
            </button>
          </div>
        )}

        {isSubmitting && <p className="turn-panel-submitting">처리 중...</p>}
      </div>

      {!isEliminated && (
        <button type="button" className="forfeit-button" onClick={handleForfeitClick}>
          게임 포기하기
        </button>
      )}
    </div>
  );
}
