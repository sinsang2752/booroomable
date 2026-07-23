import type { PlayerColor } from './types.ts';

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
/** 건물 시스템 도입으로 0.2 -> 0.1 (CLAUDE.md 미정사항: level 0 통행료는 땅값의 10%가 기준) */
export const LAND_TOLL_RATIO = 0.1;

/** 건물 업그레이드: 레벨 0(땅만)~4(호텔). 이름/통행료 배수/건설비 배율은 CLAUDE.md "건물 시스템" 표 그대로. */
export const MAX_BUILDING_LEVEL = 4;
export const BUILDING_LEVEL_NAMES = ['땅', '별장1', '별장2', '빌딩', '호텔'];
/** tile.toll(=price*LAND_TOLL_RATIO)에 곱하는 레벨별 배수. 결과 = price * [0.1, 0.5, 1.5, 3, 4.5] */
export const BUILDING_TOLL_LEVEL_MULTIPLIERS = [1, 5, 15, 30, 45];
/** index = 현재 레벨(0~3), 값 = 다음 레벨로 올릴 때 price에 곱하는 건설비 비율 */
export const BUILDING_UPGRADE_COST_RATIOS = [0.4, 0.4, 1.5, 2.5];

export const PLAYER_COLORS: PlayerColor[] = ['blue', 'red', 'green', 'amber'];
