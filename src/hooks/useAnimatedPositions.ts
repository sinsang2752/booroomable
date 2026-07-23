import { useEffect, useRef, useState } from 'react';
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
 * 인터벌이 두 개 생겨 두 배 속도로 움직이는 버그를 피한다. */
export function useAnimatedPositions(players: Player[], notice: string | null): Record<string, number> {
  const [, setTick] = useState(0);
  const displayRef = useRef<Record<string, number>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const targetsRef = useRef<Record<string, number>>({});
  const noticeRef = useRef(notice);
  noticeRef.current = notice;

  // 매 렌더마다 최신 목표/초기값을 동기적으로 기록해둔다.
  for (const player of players) {
    targetsRef.current[player.id] = player.position;
    if (displayRef.current[player.id] === undefined) {
      displayRef.current[player.id] = player.position;
    }
  }

  useEffect(() => {
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
  }, [players, notice]);

  useEffect(
    () => () => {
      for (const id of Object.keys(timersRef.current)) clearInterval(timersRef.current[id]);
    },
    [],
  );

  return { ...displayRef.current };
}
