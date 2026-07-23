import { BOARD } from './board';
import {
  BOARD_SIZE,
  DICE_SIDES,
  PLAYER_COLORS,
  SALARY_ON_PASS_START,
  START_TILE_IDX,
  STARTING_BALANCE,
} from './config';
import type { GameAction, GameState, Player } from './types';

function rollDie(): number {
  return Math.floor(Math.random() * DICE_SIDES) + 1;
}

export function createInitialState(names: string[]): GameState {
  const players: Player[] = names.map((name, i) => ({
    id: `p${i + 1}`,
    name: name.trim() || `Player ${i + 1}`,
    color: PLAYER_COLORS[i],
    seatOrder: i,
    position: START_TILE_IDX,
    balance: STARTING_BALANCE,
    isBankrupt: false,
    skipNextTurn: false,
  }));

  return {
    phase: 'awaiting-roll',
    players,
    currentPlayerIndex: 0,
    tileOwners: Array(BOARD_SIZE).fill(null),
    lastRoll: null,
    isDoubleRoll: false,
    pendingPurchaseTileIdx: null,
    winnerId: null,
    turnNumber: 1,
    notice: null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ROLL_DICE':
      return handleRollDice(state);
    case 'DECIDE_PURCHASE':
      return handleDecidePurchase(state, action.buy);
    default:
      return state;
  }
}

function handleRollDice(state: GameState): GameState {
  if (state.phase !== 'awaiting-roll') return state;

  const d1 = rollDie();
  const d2 = rollDie();
  const isDouble = d1 === d2;
  const sum = d1 + d2;

  const players = state.players.map((p) => ({ ...p }));
  const currentPlayer = players[state.currentPlayerIndex];

  const rawNewPos = currentPlayer.position + sum;
  const wrapped = rawNewPos >= BOARD_SIZE;
  const newPos = rawNewPos % BOARD_SIZE;
  currentPlayer.position = newPos;

  let notice: string | null = null;

  if (wrapped) {
    currentPlayer.balance += SALARY_ON_PASS_START;
    notice = `${currentPlayer.name}님이 출발지를 지나 월급 ${SALARY_ON_PASS_START}을 받았습니다.`;
  }

  const tile = BOARD[newPos];
  const tileOwners = state.tileOwners;
  let phase: GameState['phase'] = 'awaiting-roll';
  let pendingPurchaseTileIdx: number | null = null;

  if (tile.type === 'jail') {
    currentPlayer.skipNextTurn = true;
    notice = `${currentPlayer.name}님이 무인도에 도착해 다음 턴을 쉽니다.`;
  } else if (tile.type === 'empty_land') {
    const ownerId = tileOwners[newPos];

    if (ownerId === currentPlayer.id) {
      // 자기 땅: 아무 일도 일어나지 않음
    } else if (ownerId) {
      const toll = tile.toll ?? 0;
      if (currentPlayer.balance < toll) {
        currentPlayer.isBankrupt = true;
        currentPlayer.balance = 0;
        notice = `${currentPlayer.name}님이 통행료 ${toll}을 내지 못해 파산했습니다.`;
      } else {
        currentPlayer.balance -= toll;
        const ownerIndex = players.findIndex((p) => p.id === ownerId);
        if (ownerIndex !== -1) {
          players[ownerIndex].balance += toll;
        }
        notice = `${currentPlayer.name}님이 ${tile.name} 통행료 ${toll}을 지불했습니다.`;
      }
    } else if (currentPlayer.balance < (tile.price ?? 0)) {
      // 살 돈이 없으면 물어볼 필요 없이 그냥 지나감
      notice = `${currentPlayer.name}님이 ${tile.name}을(를) 살 돈이 없어 지나갑니다.`;
    } else {
      phase = 'awaiting-purchase-decision';
      pendingPurchaseTileIdx = newPos;
      notice = `${currentPlayer.name}님, ${tile.name}(${tile.price}) 구매하시겠습니까?`;
    }
  }

  const rolledState: GameState = {
    ...state,
    players,
    tileOwners,
    lastRoll: [d1, d2],
    isDoubleRoll: isDouble,
    phase,
    pendingPurchaseTileIdx,
    notice,
  };

  if (phase === 'awaiting-purchase-decision') {
    return rolledState;
  }

  return finishTurnStep(rolledState, isDouble);
}

function handleDecidePurchase(state: GameState, buy: boolean): GameState {
  if (state.phase !== 'awaiting-purchase-decision' || state.pendingPurchaseTileIdx === null) {
    return state;
  }

  const tileIdx = state.pendingPurchaseTileIdx;
  const tile = BOARD[tileIdx];
  const players = state.players.map((p) => ({ ...p }));
  const currentPlayer = players[state.currentPlayerIndex];
  let tileOwners = state.tileOwners;
  let notice: string;

  if (buy && tile.price !== null && currentPlayer.balance >= tile.price) {
    currentPlayer.balance -= tile.price;
    tileOwners = [...tileOwners];
    tileOwners[tileIdx] = currentPlayer.id;
    notice = `${currentPlayer.name}님이 ${tile.name}을 구매했습니다.`;
  } else {
    notice = `${currentPlayer.name}님이 ${tile.name}을 구매하지 않았습니다.`;
  }

  const resolvedState: GameState = {
    ...state,
    players,
    tileOwners,
    phase: 'awaiting-roll',
    pendingPurchaseTileIdx: null,
    notice,
  };

  return finishTurnStep(resolvedState, state.isDoubleRoll);
}

/** 승리 판정 -> 더블이면 재굴림, 아니면 다음 사람으로 턴 이동. ROLL_DICE와 DECIDE_PURCHASE 양쪽에서 공용으로 사용. */
function finishTurnStep(state: GameState, isDouble: boolean): GameState {
  const alive = state.players.filter((p) => !p.isBankrupt);

  if (alive.length <= 1) {
    return { ...state, phase: 'game-over', winnerId: alive[0]?.id ?? null };
  }

  if (isDouble) {
    return { ...state, phase: 'awaiting-roll' };
  }

  return advanceToNextPlayer(state);
}

function advanceToNextPlayer(state: GameState): GameState {
  const n = state.players.length;
  const players = state.players.map((p) => ({ ...p }));
  let candidateIndex = (state.currentPlayerIndex + 1) % n;
  let iterations = 0;

  while (iterations < n) {
    const candidate = players[candidateIndex];

    if (candidate.isBankrupt) {
      candidateIndex = (candidateIndex + 1) % n;
      iterations += 1;
      continue;
    }

    if (candidate.skipNextTurn) {
      candidate.skipNextTurn = false;
      candidateIndex = (candidateIndex + 1) % n;
      iterations += 1;
      continue;
    }

    break;
  }

  return {
    ...state,
    players,
    currentPlayerIndex: candidateIndex,
    phase: 'awaiting-roll',
    turnNumber: state.turnNumber + 1,
  };
}
