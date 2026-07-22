import { BOARD_SIZE, JAIL_TILE_IDX, START_TILE_IDX, TOP_ROW_LENGTH } from './config';

export interface TilePosition {
  /** 0-100, percentage position within the board container */
  xPct: number;
  yPct: number;
}

const CORNER_X_LEFT = 3;
const CORNER_X_RIGHT = 97;
const TOP_Y = 15;
const BOTTOM_Y = 85;
const CORNER_Y = 50;

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
