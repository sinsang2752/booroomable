// 클라이언트 시스템 시계는 PC마다 어긋나 있을 수 있어서(동기화 안 됨, 시간대 오류 등),
// 턴 타이머처럼 서버 시각(turn_started_at) 기준으로 남은 시간을 계산하는 곳에서 그냥
// Date.now()를 쓰면 PC마다 표시되는 초가 크게 달라진다. Supabase 응답의 HTTP Date
// 헤더로 "서버 시계 - 내 시계" 오차를 추정해두고, 그 오차만큼 보정한 시각을 대신 쓴다.
let offsetMs = 0;

export function getServerNow(): number {
  return Date.now() + offsetMs;
}

export function updateClockOffsetFromResponse(response: Response): void {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return;

  const serverTime = new Date(dateHeader).getTime();
  if (Number.isNaN(serverTime)) return;

  offsetMs = serverTime - Date.now();
}
