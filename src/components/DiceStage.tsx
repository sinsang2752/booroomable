import { useEffect, useRef, useState } from 'react';
import type { GameState, PlayerColor } from '../game/types';

interface DiceStageProps {
  lastRoll: GameState['lastRoll'];
  isDoubleRoll: boolean;
  phase: GameState['phase'];
  playerName: string;
  playerColor: PlayerColor;
}

const PIP_LAYOUT: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

function DieFace({ value }: { value: number | null }) {
  const active = value !== null ? PIP_LAYOUT[value] : [];
  return (
    <div className="die-face">
      {Array.from({ length: 9 }, (_, i) => i + 1).map((cell) => (
        <span key={cell} className={`die-pip${active.includes(cell) ? ' die-pip--on' : ''}`} />
      ))}
    </div>
  );
}

export function DiceStage({ lastRoll, isDoubleRoll, phase, playerName, playerColor }: DiceStageProps) {
  const [isRolling, setIsRolling] = useState(false);
  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastRoll) return;
    const key = `${lastRoll[0]}-${lastRoll[1]}`;
    if (prevKeyRef.current === null) {
      // 재접속 등으로 이미 굴려진 상태로 들어온 첫 렌더는 애니메이션 없이 바로 표시
      prevKeyRef.current = key;
      return;
    }
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;
    setIsRolling(true);
    const timer = setTimeout(() => setIsRolling(false), 800);
    return () => clearTimeout(timer);
  }, [lastRoll]);

  const showDouble = isDoubleRoll && phase === 'awaiting-roll' && !isRolling;

  return (
    <div className="dice-stage">
      <div className="dice-stage-row">
        <span className="dice-stage-player" style={{ color: `var(--color-${playerColor})` }}>
          {playerName}님 차례
        </span>
        <div className={`dice-pair${isRolling ? ' dice-pair--rolling' : ''}`}>
          <DieFace value={lastRoll ? lastRoll[0] : null} />
          <DieFace value={lastRoll ? lastRoll[1] : null} />
        </div>
      </div>
      {!lastRoll && !isRolling && <p className="dice-stage-hint">주사위 대기 중</p>}
      {lastRoll && !isRolling && <p className="dice-stage-sum">합계 {lastRoll[0] + lastRoll[1]}</p>}
      {showDouble && <p className="dice-stage-double">더블! 한 번 더</p>}
    </div>
  );
}
