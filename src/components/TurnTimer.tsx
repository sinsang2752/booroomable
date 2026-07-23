import { useEffect, useState } from 'react';

interface TurnTimerProps {
  turnNumber: number;
  turnDeadlineMs: number | null;
  turnTimeSec: number | null;
}

export function TurnTimer({ turnNumber, turnDeadlineMs, turnTimeSec }: TurnTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // turn_started_at은 서버(Edge Function) 시계로 찍히는데 여기 now는 브라우저 시계라,
  // 둘 사이 오차(보통 1초 안팎)로 방금 막 시작한 턴이 설정값보다 커 보일 수 있다.
  // 실제 자동진행 판정은 서버가 자기 시계로만 하니 정확하고, 여기는 화면 표시만 방어적으로 clamp.
  const secondsLeft =
    turnDeadlineMs !== null
      ? Math.max(0, Math.min(turnTimeSec ?? Infinity, Math.ceil((turnDeadlineMs - now) / 1000)))
      : null;

  return (
    <div className="turn-timer">
      <span className="turn-timer-number">턴 {turnNumber}</span>
      {secondsLeft !== null && (
        <span
          className={`turn-timer-countdown${secondsLeft <= 10 ? ' turn-timer-countdown--warning' : ''}`}
        >
          {secondsLeft}초
        </span>
      )}
    </div>
  );
}
