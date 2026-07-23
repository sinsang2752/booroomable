import {
  BOARD_SIZE,
  JAIL_TILE_IDX,
  LAND_BASE_PRICE,
  LAND_PRICE_STEP,
  LAND_TOLL_RATIO,
  START_TILE_IDX,
} from './config.ts';
import type { Tile } from './types.ts';

function buildBoard(): Tile[] {
  const tiles: Tile[] = [];
  let lane = 0;

  for (let idx = 0; idx < BOARD_SIZE; idx += 1) {
    if (idx === START_TILE_IDX) {
      tiles.push({ idx, name: '출발', type: 'start', price: null, toll: null });
      continue;
    }
    if (idx === JAIL_TILE_IDX) {
      tiles.push({ idx, name: '무인도', type: 'jail', price: null, toll: null });
      continue;
    }

    const price = LAND_BASE_PRICE + lane * LAND_PRICE_STEP;
    const toll = Math.round(price * LAND_TOLL_RATIO);
    tiles.push({ idx, name: `땅 ${lane + 1}`, type: 'empty_land', price, toll });
    lane += 1;
  }

  return tiles;
}

export const BOARD: Tile[] = buildBoard();
