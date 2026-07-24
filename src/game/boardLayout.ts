import { BOARD_SIZE, JAIL_TILE_IDX, START_TILE_IDX, TOP_ROW_LENGTH } from './config';

export interface TilePosition {
  /** 0-100, percentage position within the board container */
  xPct: number;
  yPct: number;
}

/* 코너(출발·무인도)를 위/아래 줄과 "분리"해서 배치한다. 예전엔 코너 x를 0/100으로 하드코딩해
 * 화면 좌우 끝에 딱 붙었는데(→ 첫 칸과 갭이 크고, 출발 칸 왼쪽 절반이 board 밖으로 나가 잘림),
 * 이제 코너도 CORNER_X_LEFT/RIGHT로 안쪽에 두어 첫/끝 칸 가까이 당긴다.
 * 위/아래 줄은 ROW_X_LEFT~ROW_X_RIGHT 범위에 균등 배치 — 코너 자리를 비워 두 영역이 안 겹치게
 * 하되, 줄 칸 간격(rowSpan/18 ≈ 4.56%)이 타일 폭(TILE_WIDTH_PCT)보다 커서 서로 안 겹친다. */
const CORNER_X_LEFT = 5.5;
const CORNER_X_RIGHT = 94.5;
const ROW_X_LEFT = 10;
const ROW_X_RIGHT = 90;
const TOP_Y = 15;
const BOTTOM_Y = 85;
const CORNER_Y = 50;

/** 위/아래 줄 한 칸이 차지하는 가로 폭(퍼센트). 타일 실제 렌더 폭(Board.tsx가 .board-cell에
 * 인라인으로 적용)이 이 값이라, game 모드 창 폭이 화면마다 달라져도(electron/main.cjs 참고)
 * 칸끼리 겹치지 않는다 — 타일을 고정 px 폭으로 뒀을 때 화면에 따라 겹치는 버그가 있었음. */
export const TILE_WIDTH_PCT = 4.4;

/** tileIdx(0~39) -> 보드 컨테이너 내 퍼센트 좌표. 알약형 트랙: 좌/우 코너 + 위/아래 직선 구간. */
export function getTilePosition(idx: number): TilePosition {
  if (idx === START_TILE_IDX) {
    return { xPct: CORNER_X_LEFT, yPct: CORNER_Y };
  }
  if (idx === JAIL_TILE_IDX) {
    return { xPct: CORNER_X_RIGHT, yPct: CORNER_Y };
  }

  const rowSpan = ROW_X_RIGHT - ROW_X_LEFT;

  if (idx < JAIL_TILE_IDX) {
    // 위 줄: idx 1~19를 [ROW_X_LEFT, ROW_X_RIGHT]에 균등 배치.
    const t = (idx - 1) / (TOP_ROW_LENGTH - 1);
    return { xPct: ROW_X_LEFT + t * rowSpan, yPct: TOP_Y };
  }

  // 아래 줄: idx 21~39를 오른쪽→왼쪽으로 균등 배치.
  const t = (idx - JAIL_TILE_IDX - 1) / (BOARD_SIZE - JAIL_TILE_IDX - 2);
  return { xPct: ROW_X_RIGHT - t * rowSpan, yPct: BOTTOM_Y };
}
