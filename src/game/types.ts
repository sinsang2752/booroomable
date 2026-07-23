export type PlayerColor = 'blue' | 'red' | 'green' | 'amber';

export type TileType =
  | 'start'
  | 'jail'
  | 'empty_land'
  | 'event'
  | 'welfare_pay'
  | 'welfare_get'
  | 'space_travel';

export type TurnPhase =
  | 'awaiting-roll'
  | 'awaiting-purchase-decision'
  | 'awaiting-build-decision'
  | 'awaiting-initial-build-decision'
  | 'awaiting-start-bonus-build'
  | 'awaiting-space-travel-destination'
  | 'game-over';

export interface Tile {
  idx: number;
  name: string;
  type: TileType;
  price: number | null;
  toll: number | null;
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  seatOrder: number;
  position: number;
  balance: number;
  isBankrupt: boolean;
  /** 0이면 무인도 아님. 1 이상이면 남은 대기 턴 수(무인도 도착 시 JAIL_TURNS로 설정). */
  jailTurnsLeft: number;
}

export interface GameState {
  phase: TurnPhase;
  players: Player[];
  currentPlayerIndex: number;
  /** length BOARD_SIZE, index-aligned with the board, value = owning player id or null */
  tileOwners: (string | null)[];
  /** length BOARD_SIZE, index-aligned with the board, 0(맨땅)~MAX_BUILDING_LEVEL */
  tileLevels: number[];
  lastRoll: [number, number] | null;
  isDoubleRoll: boolean;
  /** 구매 대기와 건물 업그레이드 대기 둘 다 이 필드를 쓴다 (phase로 구분) */
  pendingPurchaseTileIdx: number | null;
  /** 황금열쇠 덱에서 아직 안 뽑은 카드의 순서(GOLDEN_KEY_DECK 인덱스). 다 뽑으면 다시 셔플. */
  eventDeck: number[];
  /** 사회복지기금 적립액. welfare_pay 칸에서 쌓이고 welfare_get 칸에서 전액 수령. */
  welfarePool: number;
  /** 현재 플레이어가 이번 턴 체인에서 연속으로 굴린 더블 횟수. 턴이 다음 사람에게 넘어가면 0으로 리셋. */
  consecutiveDoubles: number;
  winnerId: string | null;
  turnNumber: number;
  notice: string | null;
}

export type GameAction =
  | { type: 'ROLL_DICE' }
  | { type: 'DECIDE_PURCHASE'; buy: boolean }
  | { type: 'DECIDE_BUILD'; build: boolean }
  | { type: 'DECIDE_INITIAL_BUILD'; targetLevel: number }
  | { type: 'DECIDE_START_BONUS_BUILD'; tileIdx: number | null }
  | { type: 'DECIDE_SPACE_TRAVEL'; tileIdx: number | null }
  | { type: 'FORFEIT'; playerId: string };
