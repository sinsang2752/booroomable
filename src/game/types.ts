export type PlayerColor = 'blue' | 'red' | 'green' | 'amber';

export type TileType = 'start' | 'jail' | 'empty_land';

export type TurnPhase = 'awaiting-roll' | 'awaiting-purchase-decision' | 'game-over';

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
  skipNextTurn: boolean;
}

export interface GameState {
  phase: TurnPhase;
  players: Player[];
  currentPlayerIndex: number;
  /** length BOARD_SIZE, index-aligned with the board, value = owning player id or null */
  tileOwners: (string | null)[];
  lastRoll: [number, number] | null;
  isDoubleRoll: boolean;
  pendingPurchaseTileIdx: number | null;
  winnerId: string | null;
  turnNumber: number;
  notice: string | null;
}

export type GameAction =
  | { type: 'ROLL_DICE' }
  | { type: 'DECIDE_PURCHASE'; buy: boolean };
