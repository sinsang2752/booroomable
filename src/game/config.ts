import type { PlayerColor } from './types.ts';

/** 밸런스 수치 모음. 플레이하며 여기 값만 조정하면 됨. */

export const BOARD_SIZE = 40;
export const TOP_ROW_LENGTH = 19;
export const BOTTOM_ROW_LENGTH = 19;
export const START_TILE_IDX = 0;
export const JAIL_TILE_IDX = 20;
/** 무인도 대기 턴 수(원작 그대로 3턴, 도중 더블이면 즉시 탈출). */
export const JAIL_TURNS = 3;
/** 이 값만큼 더블을 연속으로 굴리면 무인도로 강제 이동(무한 더블 방지). */
export const CONSECUTIVE_DOUBLES_LIMIT = 3;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export const DICE_SIDES = 6;
export const DICE_COUNT = 2;

export const STARTING_BALANCE = 3000;
export const SALARY_ON_PASS_START = 200;

/** 땅값은 board.ts의 LAND_DEFS(구역별 계단식 테이블, CLAUDE.md "보드 칸 구성" 표)에서 직접 정의한다.
 * level 0 통행료는 그 가격의 이 비율(landmark 제외 — landmark는 고정 통행료, board.ts 참고). */
export const LAND_TOLL_RATIO = 0.1;

/** 건물 업그레이드: 레벨 0(땅만)~4(호텔). 이름/통행료 배수는 CLAUDE.md "건물 시스템" 표 그대로. */
export const MAX_BUILDING_LEVEL = 4;
export const BUILDING_LEVEL_NAMES = ['땅', '별장1', '별장2', '빌딩', '호텔'];
/** tile.toll(=price*LAND_TOLL_RATIO)에 곱하는 레벨별 배수. 결과 = price * [0.1, 0.5, 1.5, 4, 8].
 * 빌딩 ×3->×4, 호텔 ×4.5->×8로 상향(원작 재분석: 건물이 대체 없이 누적 합산되는 원작 구조를
 * 이 프로젝트는 안 쓰는 대신, 최고 등급 배율을 원작의 누적 결과치에 맞춰 올려 같은 효과를 냄
 * — CLAUDE.md "통행료 배율" 절 참고). */
export const BUILDING_TOLL_LEVEL_MULTIPLIERS = [1, 5, 15, 40, 80];
/** 구역별 건설비(원작처럼 땅값과 무관하게 구역 안에서 고정, CLAUDE.md "건설비: 구역별 고정" 참고).
 * index 0~3 = Zone 1~4. 구역 판정은 Math.floor(tileIdx / 10) — 구역이 idx 10단위와 정확히 나뉘어
 * 있어서(특수칸이 x0/x5에 있음) 이 공식 하나로 충분하다(buildings.ts::getUpgradeCost 참고).
 * villa는 별장1/별장2 둘 다 같은 금액(원작 규칙 — 별장2는 별장1과 같은 금액을 한 번 더 낸다). */
export const ZONE_BUILD_COST = [
  { villa: 60, building: 150, hotel: 250 }, // Zone 1
  { villa: 120, building: 300, hotel: 500 }, // Zone 2
  { villa: 160, building: 430, hotel: 750 }, // Zone 3
  { villa: 200, building: 600, hotel: 1000 }, // Zone 4
];

/** 파산 방지 자동매각(통행료 낼 돈 부족 시): 건설비/땅값의 몇 %를 되돌려받는지. 100%로 시작, 파산이 너무 안 나면 낮출 것. */
export const BUILDING_SALE_RATIO = 1;
export const LAND_SALE_RATIO = 1;

/** 황금열쇠 칸 위치. 40칸 트랙에 고르게 분산(CLAUDE.md "특수칸 배치 주의" 참고). 개수/위치는 플레이하며 조정 가능. */
export const EVENT_TILE_INDICES = [5, 15, 25, 35];

/** 사회복지기금: 기부 칸/수령 칸을 트랙 반대편에 대칭 배치. 기부액은 다른 카드들과 같은 스케일. */
export const WELFARE_PAY_TILE_IDX = 10;
export const WELFARE_GET_TILE_IDX = 30;
export const WELFARE_PAY_AMOUNT = 100;

/** 우주여행 칸. 도착하면 보드의 원하는 칸으로 이동(자기 자신은 목적지로 다시 못 고름). */
export const SPACE_TRAVEL_TILE_IDX = 18;

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
