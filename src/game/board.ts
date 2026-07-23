import {
  BOARD_SIZE,
  EVENT_TILE_INDICES,
  JAIL_TILE_IDX,
  LAND_BASE_PRICE,
  LAND_PRICE_STEP,
  LAND_TOLL_RATIO,
  SPACE_TRAVEL_TILE_IDX,
  START_TILE_IDX,
  WELFARE_GET_TILE_IDX,
  WELFARE_PAY_TILE_IDX,
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
    if (EVENT_TILE_INDICES.includes(idx)) {
      tiles.push({ idx, name: '황금열쇠', type: 'event', price: null, toll: null });
      continue;
    }
    if (idx === WELFARE_PAY_TILE_IDX) {
      tiles.push({ idx, name: '복지기금 납부', type: 'welfare_pay', price: null, toll: null });
      continue;
    }
    if (idx === WELFARE_GET_TILE_IDX) {
      tiles.push({ idx, name: '복지기금 수령', type: 'welfare_get', price: null, toll: null });
      continue;
    }
    if (idx === SPACE_TRAVEL_TILE_IDX) {
      tiles.push({ idx, name: '우주여행', type: 'space_travel', price: null, toll: null });
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
