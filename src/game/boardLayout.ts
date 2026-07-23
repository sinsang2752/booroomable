import { BOARD_SIZE, JAIL_TILE_IDX, START_TILE_IDX, TOP_ROW_LENGTH } from './config';

export interface TilePosition {
  /** 0-100, percentage position within the board container */
  xPct: number;
  yPct: number;
}

/* 예전엔 3/97이라 코너(출발·무인도, xPct 0/100)와 첫 줄 칸 사이 간격(7.7%)이 칸끼리
 * 간격(4.7%)보다 훨씬 넓어서 "코너가 유독 멀어 보인다"는 피드백을 받았다. 0/100으로 바꿔서
 * 코너도 같은 20칸 균등분할 격자에 포함시키면 간격이 전부 5%로 통일된다. */
const CORNER_X_LEFT = 0;
const CORNER_X_RIGHT = 100;
const TOP_Y = 15;
const BOTTOM_Y = 85;
const CORNER_Y = 50;

/** 위/아래 줄 한 칸이 차지하는 가로 폭(퍼센트) — (CORNER_X_RIGHT-CORNER_X_LEFT)/20칸 slot(4.7%)
 * 중 85%만 채워서 칸 사이에 여백을 남긴다. 타일 실제 렌더 폭(Board.tsx가 .board-cell에
 * 인라인으로 적용)이 이 값이라, game 모드 창 폭이 화면마다 달라져도(electron/main.cjs 참고)
 * 칸끼리 겹치지 않는다 — 타일을 고정 px 폭으로 뒀을 때 화면에 따라 겹치는 버그가 있었음. */
export const TILE_WIDTH_PCT = 4.4;

/** tileIdx(0~39) -> 보드 컨테이너 내 퍼센트 좌표. 알약형 트랙: 좌/우 코너 + 위/아래 직선 구간. */
export function getTilePosition(idx: number): TilePosition {
  if (idx === START_TILE_IDX) {
    return { xPct: 0, yPct: CORNER_Y };
  }
  if (idx === JAIL_TILE_IDX) {
    return { xPct: 100, yPct: CORNER_Y };
  }

  const span = CORNER_X_RIGHT - CORNER_X_LEFT;

  if (idx < JAIL_TILE_IDX) {
    const t = idx / (TOP_ROW_LENGTH + 1);
    return { xPct: CORNER_X_LEFT + t * span, yPct: TOP_Y };
  }

  const j = idx - JAIL_TILE_IDX;
  const t = j / (BOARD_SIZE - JAIL_TILE_IDX);
  return { xPct: CORNER_X_RIGHT - t * span, yPct: BOTTOM_Y };
}
