import type { PlayerColor } from './types';

/** 밸런스 수치 모음. 플레이하며 여기 값만 조정하면 됨. */

export const BOARD_SIZE = 40;
export const TOP_ROW_LENGTH = 19;
export const BOTTOM_ROW_LENGTH = 19;
export const START_TILE_IDX = 0;
export const JAIL_TILE_IDX = 20;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export const DICE_SIDES = 6;
export const DICE_COUNT = 2;

export const STARTING_BALANCE = 1500;
export const SALARY_ON_PASS_START = 200;

/** 땅 가격/통행료는 손으로 38개를 적는 대신 공식으로 생성 (board.ts 참고) */
export const LAND_BASE_PRICE = 100;
export const LAND_PRICE_STEP = 20;
export const LAND_TOLL_RATIO = 0.2;

export const PLAYER_COLORS: PlayerColor[] = ['blue', 'red', 'green', 'amber'];
