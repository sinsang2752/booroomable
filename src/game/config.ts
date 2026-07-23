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

/** 파산 방지 자동매각(통행료 낼 돈 부족 시): 건설비/땅값의 몇 %를 되돌려받는지. 100%로 시작, 파산이 너무 안 나면 낮출 것. */
export const BUILDING_SALE_RATIO = 1;
export const LAND_SALE_RATIO = 1;

/** 황금열쇠 칸 위치. 40칸 트랙에 고르게 분산(CLAUDE.md "특수칸 배치 주의" 참고). 개수/위치는 플레이하며 조정 가능. */
export const EVENT_TILE_INDICES = [5, 15, 25, 35];

/** 사회복지기금: 기부 칸/수령 칸을 트랙 반대편에 대칭 배치. 기부액은 다른 카드들과 같은 스케일. */
export const WELFARE_PAY_TILE_IDX = 10;
export const WELFARE_GET_TILE_IDX = 30;
export const WELFARE_PAY_AMOUNT = 100;

/** 황금열쇠 1차 덱: 상금/벌금/생일축하/이동. 원작 예시 금액(30만/20만/10만/5만 등)을 우리 경제 규모(초기자본 1500)에 맞춰 1/1000로 스케일.
 * "특정 칸으로 이동" 카드는 우리 보드에 원작의 철도·전기회사 같은 지정 대상이 없어 도입하지 않는다. */
export type GoldenKeyCardType =
  | 'prize'
  | 'fine'
  | 'birthday'
  | 'move_to_start'
  | 'move_to_jail'
  | 'move_back'
  | 'building_upkeep'
  | 'forced_sale'
  | 'move_to_welfare_get';
export interface GoldenKeyCard {
  type: GoldenKeyCardType;
  amount?: number; // prize/fine/birthday 금액
  tiles?: number; // move_back 전용: 뒤로 이동할 칸 수
  /** building_upkeep 전용: 별장(레벨1·2 공통)/빌딩(레벨3)/호텔(레벨4) 등급별 단가 */
  rates?: { villa: number; building: number; hotel: number };
  label: string;
}
export const GOLDEN_KEY_DECK: GoldenKeyCard[] = [
  { type: 'prize', amount: 300, label: '노벨상' },
  { type: 'prize', amount: 200, label: '복권' },
  { type: 'prize', amount: 100, label: '장학금' },
  { type: 'prize', amount: 50, label: '연금' },
  { type: 'fine', amount: 100, label: '해외유학' },
  { type: 'fine', amount: 50, label: '병원비' },
  { type: 'birthday', amount: 30, label: '생일축하' },
  { type: 'move_to_start', label: '출발지로 이동' },
  { type: 'move_to_jail', label: '무인도로 이동' },
  { type: 'move_back', tiles: 2, label: '뒤로 2칸 이동' },
  { type: 'move_back', tiles: 3, label: '뒤로 3칸 이동' },
  { type: 'building_upkeep', label: '정기종합소득세', rates: { villa: 30, building: 100, hotel: 150 } },
  { type: 'building_upkeep', label: '건물수리비', rates: { villa: 30, building: 60, hotel: 100 } },
  { type: 'building_upkeep', label: '방범비', rates: { villa: 10, building: 30, hotel: 50 } },
  { type: 'forced_sale', label: '반액대매출' },
  { type: 'move_to_welfare_get', label: '사회복지기금 접수처로 이동' },
];

export const PLAYER_COLORS: PlayerColor[] = ['blue', 'red', 'green', 'amber'];
