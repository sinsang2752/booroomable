import { useEffect, useState } from 'react';
import { getServerNow } from '../lib/serverClock';

interface TurnTimerProps {
  turnNumber: number;
  turnDeadlineMs: number | null;
  turnTimeSec: number | null;
}

export function TurnTimer({ turnNumber, turnDeadlineMs, turnTimeSec }: TurnTimerProps) {
  const [now, setNow] = useState(() => getServerNow());
  useEffect(() => {
    const interval = setInterval(() => setNow(getServerNow()), 1000);
    return () => clearInterval(interval);
  }, []);

  // turn_started_at은 서버(Edge Function) 시계로 찍히는데, PC마다 시스템 시계가 실제
  // 시간과 어긋나 있을 수 있어서 그냥 브라우저 Date.now()를 쓰면 PC마다 표시되는 초가
  // 크게 달라진다. getServerNow()는 Supabase 응답의 Date 헤더로 추정한 서버-내 시계
  // 오차를 보정해주므로, 실제로는 몇 초 이상 차이 나던 게 네트워크 오차 수준(1초 안팎)으로
  // 줄어든다. 실제 자동진행 판정은 서버가 자기 시계로만 하니 정확하고, 여기는 화면 표시만
  // 방어적으로 clamp.
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
