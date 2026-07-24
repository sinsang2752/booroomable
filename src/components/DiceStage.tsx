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

/** 주사위 굴림 애니메이션 길이(ms). 말 이동을 이 시간 뒤로 미뤄 "주사위 멈춘 뒤 걷게"
 * 하는 데에도 쓰인다(App.tsx → useAnimatedPositions). */
export const ROLL_MS = 850;

function randomFace(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function DiceStage({ lastRoll, isDoubleRoll, phase, playerName, playerColor }: DiceStageProps) {
  const [isRolling, setIsRolling] = useState(false);
  // 굴리는 동안 최종 눈을 가리고 보여줄 랜덤 눈(빠르게 바뀜). null이면 안 굴리는 중.
  const [rollingFaces, setRollingFaces] = useState<[number, number] | null>(null);
  const prevKeyRef = useRef<string | null>(null);
  // 롤 종료 타이머는 ref로 들고 있는다. lastRoll은 refresh마다 새 배열로 오므로(mapping.ts)
  // effect가 자주 재실행되는데, cleanup에서 타이머를 지우면 "눈이 같아 early return →
  // 타이머 재설정 안 함"으로 isRolling이 영영 안 꺼지는 무한 롤링이 됐다. effect 재실행에
  // 흔들리지 않게 새 눈이 나올 때만 (이전 타이머 정리 + 새 타이머 설정)한다.
  const rollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
    rollTimerRef.current = setTimeout(() => setIsRolling(false), ROLL_MS);
  }, [lastRoll]);

  // 언마운트 시에만 타이머 정리(effect 재실행 때는 유지).
  useEffect(
    () => () => {
      if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
    },
    [],
  );

  // 굴리는 동안 눈을 빠르게 바꿔 "뭐가 나올지 모르는" 상태를 보여준다(멈추면 lastRoll 공개).
  useEffect(() => {
    if (!isRolling) {
      setRollingFaces(null);
      return;
    }
    setRollingFaces([randomFace(), randomFace()]);
    const iv = setInterval(() => setRollingFaces([randomFace(), randomFace()]), 70);
    return () => clearInterval(iv);
  }, [isRolling]);

  const showDouble = isDoubleRoll && phase === 'awaiting-roll' && !isRolling;
  // 굴리는 중엔 가림용 랜덤 눈, 아니면 실제 결과.
  const face1 = isRolling ? (rollingFaces?.[0] ?? null) : lastRoll ? lastRoll[0] : null;
  const face2 = isRolling ? (rollingFaces?.[1] ?? null) : lastRoll ? lastRoll[1] : null;

  return (
    <div className="dice-stage">
      <div className="dice-stage-row">
        <span className="dice-stage-player" style={{ color: `var(--color-${playerColor})` }}>
          {playerName}님 차례
        </span>
        <div className={`dice-pair${isRolling ? ' dice-pair--rolling' : ''}`}>
          <DieFace value={face1} />
          <DieFace value={face2} />
        </div>
      </div>
      {!lastRoll && !isRolling && <p className="dice-stage-hint">주사위 대기 중</p>}
      {isRolling && <p className="dice-stage-hint">굴리는 중...</p>}
      {lastRoll && !isRolling && <p className="dice-stage-sum">합계 {lastRoll[0] + lastRoll[1]}</p>}
      {showDouble && <p className="dice-stage-double">더블! 한 번 더</p>}
    </div>
  );
}
