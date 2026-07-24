import { useEffect, useRef, useState } from 'react';
import { ROLL_MS } from '../components/DiceStage';
import { BOARD_SIZE } from '../game/config';
import type { Player } from '../game/types';

/** 한 칸 이동에 걸리는 시간(ms). 다이스 이동(2~12칸)은 짧게, 드물게 먼 이동(우주여행 등)은
 * 길게 자연스럽게 걸린다. */
const STEP_MS = 150;

/** 더블 3연속 → 무인도 강제 이동은 텔레포트라 걸어가는 개념 자체가 없다(CLAUDE.md 명시) —
 * 애니메이션 없이 즉시 스냅. 그 외에는 기본 전진, "뒤로" 카드만 후진으로 걷는다. 이동 종류를
 * 직접 알 방법이 없어(서버는 최종 위치만 내려줌) notice 문구로 구분한다 — TurnPanel.tsx의
 * classifyNotice와 같은 패턴. */
function resolveStepMode(notice: string | null): 'skip' | 'backward' | 'forward' {
  const text = notice ?? '';
  if (text.includes('연속') && text.includes('강제')) return 'skip';
  if (text.includes('뒤로')) return 'backward';
  return 'forward';
}

/** 말이 새 위치로 순간이동하지 않고 한 칸씩 걸어서 이동하는 것처럼 보이게 하는 훅.
 * 실제 게임 상태(player.position)는 그대로 두고, 화면에 "지금 보여줄 위치"만 별도로
 * 관리하며 서서히 목표를 따라가게 한다 — 그래서 게임 로직/동기화에는 전혀 영향이 없다.
 *
 * displayRef를 진짜 상태로 쓰고 useState는 리렌더를 강제하는 용도로만 쓴다 — 개발 모드
 * StrictMode가 effect를 두 번 실행해도(mount→cleanup→mount) "이미 타이머가 있는지" 확인과
 * "타이머 등록"이 setState 콜백을 거치지 않고 같은 동기 실행 안에서 끝나서, 같은 말에
 * 인터벌이 두 개 생겨 두 배 속도로 움직이는 버그를 피한다.
 *
 * rollKey: 새 주사위 굴림을 식별하는 값(App.tsx가 lastRoll로 만들어 넘김). 이 값이 바뀌면
 * 주사위 애니메이션(ROLL_MS)이 끝날 때까지 걷기 시작을 미룬다 — "주사위가 멈춘 뒤 말이
 * 걷게" 하기 위함. **홀드 판단을 이 훅 안에서 target 갱신과 같은 렌더/같은 effect로 처리하는
 * 게 핵심**: 예전엔 부모(App)의 별도 effect에서 holdUntil을 계산했는데, React가 자식(Board)
 * effect를 부모 effect보다 먼저 실행해서 홀드 값이 한 렌더 늦게 도착 → 새 위치가 온 첫 렌더에선
 * 홀드가 과거값이라 말이 즉시 걸어버리는 경쟁 상태가 있었다(주사위 애니메이션 도중 말이 이동). */
export function useAnimatedPositions(
  players: Player[],
  notice: string | null,
  rollKey: string | null = null,
): Record<string, number> {
  const [, setTick] = useState(0);
  const [holdRelease, setHoldRelease] = useState(0);
  const displayRef = useRef<Record<string, number>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const targetsRef = useRef<Record<string, number>>({});
  const noticeRef = useRef(notice);
  noticeRef.current = notice;
  const holdUntilRef = useRef(0);
  // undefined = 아직 초기화 전. 첫 렌더에선 (신규/재접속 무관) 홀드 없이 rollKey만 기록해두고,
  // 그 이후 값이 바뀔 때만 진짜 새 굴림으로 보고 홀드를 건다.
  const prevRollKeyRef = useRef<string | null | undefined>(undefined);

  // 매 렌더마다 최신 목표/초기값을 동기적으로 기록해둔다.
  for (const player of players) {
    targetsRef.current[player.id] = player.position;
    if (displayRef.current[player.id] === undefined) {
      displayRef.current[player.id] = player.position;
    }
  }

  useEffect(() => {
    // 새 굴림 감지 → 주사위 애니메이션이 끝나는 시각까지 걷기 시작 지연. target 갱신(위)과
    // 같은 effect라 부모/자식 effect 실행 순서에 따른 지연이 없다.
    if (prevRollKeyRef.current === undefined) {
      prevRollKeyRef.current = rollKey;
    } else if (rollKey !== prevRollKeyRef.current) {
      prevRollKeyRef.current = rollKey;
      if (rollKey !== null) holdUntilRef.current = Date.now() + ROLL_MS;
    }

    const wait = holdUntilRef.current - Date.now();
    if (wait > 0) {
      // 아직 주사위가 구르는 중 — 걷기 시작을 미루고, 끝나는 시점에 holdRelease를 갱신해
      // 이 effect를 다시 돌려 그때 걷기 시작한다. (이미 걷고 있는 인터벌은 건드리지 않음.)
      const t = setTimeout(() => setHoldRelease((x) => x + 1), wait + 10);
      return () => clearTimeout(t);
    }

    for (const player of players) {
      const id = player.id;
      if (timersRef.current[id]) continue; // 이미 걷고 있으면 그대로 둔다

      const current = displayRef.current[id];
      const target = targetsRef.current[id];
      if (current === target) continue;

      const mode = resolveStepMode(noticeRef.current);
      if (mode === 'skip') {
        displayRef.current[id] = target;
        setTick((t) => t + 1);
        continue;
      }

      const step = mode === 'backward' ? -1 : 1;
      timersRef.current[id] = setInterval(() => {
        const cur = displayRef.current[id];
        const latestTarget = targetsRef.current[id];
        if (cur === latestTarget) {
          clearInterval(timersRef.current[id]);
          delete timersRef.current[id];
          return;
        }
        displayRef.current[id] = ((cur + step) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE;
        setTick((t) => t + 1);
      }, STEP_MS);
    }
  }, [players, notice, rollKey, holdRelease]);

  useEffect(
    () => () => {
      for (const id of Object.keys(timersRef.current)) clearInterval(timersRef.current[id]);
    },
    [],
  );

  return { ...displayRef.current };
}
