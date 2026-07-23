import {
  BOARD_SIZE,
  EVENT_TILE_INDICES,
  JAIL_TILE_IDX,
  LAND_TOLL_RATIO,
  SPACE_TRAVEL_TILE_IDX,
  START_TILE_IDX,
  WELFARE_GET_TILE_IDX,
  WELFARE_PAY_TILE_IDX,
} from './config.ts';
import type { Tile } from './types.ts';

interface LandDef {
  name: string;
  price: number;
  /** true면 landmark(건물 불가, 고정 통행료 fixedToll) — CLAUDE.md "landmark" 절 참고. */
  landmark?: boolean;
  fixedToll?: number;
  /** 타일 카드에 표시할 국기 — ISO 3166-1 alpha-2 소문자 코드(`flag-icons` 패키지의
   * `fi-{code}` 클래스와 그대로 대응). 순수 표시용이라 game/types.ts의 Tile에는 안 넣고
   * TILE_FLAGS 조회 테이블로만 분리해둔다(엔진은 이 값을 전혀 참조하지 않음).
   * 국기 이모지(유니코드)를 처음 썼는데 Windows에서 그림 대신 빈 상자/글자로 보이는
   * 문제가 있어서(플랫폼 이모지 폰트 지원 차이) 실제 SVG 파일 기반인 flag-icons로 교체함. */
  flag: string;
}

/** 땅 31칸의 실제 지역명/가격/landmark 여부 (CLAUDE.md "보드 칸 구성" 표 순서 그대로, Zone 1~4 순).
 * buildBoard()의 lane 카운터(0~30)가 이 배열의 인덱스와 정확히 대응한다. */
const LAND_DEFS: LandDef[] = [
  // Zone 1 — 아시아 저가권 (idx 1,2,3,4,6,7,8,9, 건설비 별장60/빌딩150/호텔250)
  { name: '하노이', price: 60, flag: 'vn' },
  { name: '자카르타', price: 80, flag: 'id' },
  { name: '마닐라', price: 80, flag: 'ph' },
  { name: '방콕', price: 100, flag: 'th' },
  { name: '쿠알라룸푸르', price: 100, flag: 'my' },
  { name: '타이베이', price: 120, flag: 'tw' },
  { name: '마카오', price: 120, flag: 'mo' },
  { name: '제주도', price: 200, landmark: true, fixedToll: 280, flag: 'kr' },
  // Zone 2 — 유럽 중저가권 (idx 11,12,13,14,16,17,19, 건설비 별장120/빌딩300/호텔500)
  { name: '아테네', price: 140, flag: 'gr' },
  { name: '프라하', price: 160, flag: 'cz' },
  { name: '리스본', price: 160, flag: 'pt' },
  { name: '바르샤바', price: 180, flag: 'pl' },
  { name: '코펜하겐', price: 180, flag: 'dk' },
  { name: '스톡홀름', price: 200, flag: 'se' },
  { name: '하와이', price: 260, landmark: true, fixedToll: 360, flag: 'us' },
  // Zone 3 — 중가권 (idx 21,22,23,24,26,27,28,29, 건설비 별장160/빌딩430/호텔750)
  { name: '부에노스아이레스', price: 220, flag: 'ar' },
  { name: '상파울루', price: 240, flag: 'br' },
  { name: '시드니', price: 240, flag: 'au' },
  { name: '멜버른', price: 260, flag: 'au' },
  { name: '두바이', price: 260, flag: 'ae' },
  { name: '바르셀로나', price: 280, flag: 'es' },
  { name: '산토리니', price: 340, landmark: true, fixedToll: 480, flag: 'gr' },
  { name: '부산', price: 480, landmark: true, fixedToll: 680, flag: 'kr' },
  // Zone 4 — 최고가권 (idx 31,32,33,34,36,37,38,39, 건설비 별장200/빌딩600/호텔1000)
  { name: '베를린', price: 300, flag: 'de' },
  { name: '로마', price: 300, flag: 'it' },
  { name: '도쿄', price: 320, flag: 'jp' },
  { name: '파리', price: 320, flag: 'fr' },
  { name: '런던', price: 350, flag: 'gb' },
  { name: '뉴욕', price: 350, flag: 'us' },
  { name: '나이아가라', price: 560, landmark: true, fixedToll: 800, flag: 'ca' },
  { name: '서울', price: 900, landmark: true, fixedToll: 1400, flag: 'kr' },
];

/** idx -> 국가 코드(ISO alpha-2 소문자, flag-icons의 fi-{code} 클래스용). land/landmark 칸만
 * 존재, 나머지 특수칸은 조회되지 않음. Tile.tsx 전용. */
export const TILE_FLAGS: Record<number, string> = {};

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

    const def = LAND_DEFS[lane];
    const toll = def.landmark ? (def.fixedToll ?? 0) : Math.round(def.price * LAND_TOLL_RATIO);
    tiles.push({
      idx,
      name: def.name,
      type: def.landmark ? 'landmark' : 'empty_land',
      price: def.price,
      toll,
    });
    TILE_FLAGS[idx] = def.flag;
    lane += 1;
  }

  return tiles;
}

export const BOARD: Tile[] = buildBoard();
