import { BOARD } from './board.ts';
import {
  BOARD_SIZE,
  BUILDING_LEVEL_NAMES,
  BUILDING_TOLL_LEVEL_MULTIPLIERS,
  BUILDING_UPGRADE_COST_RATIOS,
  DICE_SIDES,
  MAX_BUILDING_LEVEL,
  PLAYER_COLORS,
  SALARY_ON_PASS_START,
  START_TILE_IDX,
  STARTING_BALANCE,
} from './config.ts';
import type { GameAction, GameState, Player } from './types.ts';

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
    tileLevels: Array(BOARD_SIZE).fill(0),
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
    case 'DECIDE_BUILD':
      return handleDecideBuild(state, action.build);
    case 'FORFEIT':
      return handleForfeit(state, action.playerId);
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
  const tileLevels = state.tileLevels;
  let phase: GameState['phase'] = 'awaiting-roll';
  let pendingPurchaseTileIdx: number | null = null;

  if (tile.type === 'jail') {
    currentPlayer.skipNextTurn = true;
    notice = `${currentPlayer.name}님이 무인도에 도착해 다음 턴을 쉽니다.`;
  } else if (tile.type === 'empty_land') {
    const ownerId = tileOwners[newPos];
    const level = tileLevels[newPos];

    if (ownerId === currentPlayer.id) {
      if (level >= MAX_BUILDING_LEVEL) {
        // 이미 최고 레벨: 아무 일도 일어나지 않음
      } else {
        const upgradeCost = Math.round((tile.price ?? 0) * BUILDING_UPGRADE_COST_RATIOS[level]);
        const nextLevelName = BUILDING_LEVEL_NAMES[level + 1];
        if (currentPlayer.balance < upgradeCost) {
          notice = `${currentPlayer.name}님이 ${tile.name} 건물을 올릴 돈이 없어 지나갑니다.`;
        } else {
          phase = 'awaiting-build-decision';
          pendingPurchaseTileIdx = newPos;
          notice = `${currentPlayer.name}님, ${tile.name}을(를) ${nextLevelName}(으)로 업그레이드하시겠습니까? (${upgradeCost})`;
        }
      }
    } else if (ownerId) {
      const toll = (tile.toll ?? 0) * BUILDING_TOLL_LEVEL_MULTIPLIERS[level];
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

  if (phase === 'awaiting-purchase-decision' || phase === 'awaiting-build-decision') {
    return rolledState;
  }

  return finishTurnStep(rolledState, isDouble);
}

/** 최초 구매 직후 감당되는 데까지 반복해서 건물을 지을 수 있게 하는 헬퍼(handleDecidePurchase/handleDecideBuild 공용).
 * 재방문 업그레이드(awaiting-build-decision)는 한 번에 한 단계로 고정이라 이 헬퍼를 쓰지 않는다. */
function offerInitialBuild(state: GameState, tileIdx: number): GameState {
  const tile = BOARD[tileIdx];
  const currentPlayer = state.players[state.currentPlayerIndex];
  const level = state.tileLevels[tileIdx];

  if (level >= MAX_BUILDING_LEVEL) {
    return finishTurnStep(state, state.isDoubleRoll);
  }

  const upgradeCost = Math.round((tile.price ?? 0) * BUILDING_UPGRADE_COST_RATIOS[level]);
  if (currentPlayer.balance < upgradeCost) {
    return finishTurnStep(state, state.isDoubleRoll);
  }

  const nextLevelName = BUILDING_LEVEL_NAMES[level + 1];
  return {
    ...state,
    phase: 'awaiting-initial-build-decision',
    pendingPurchaseTileIdx: tileIdx,
    notice: `${currentPlayer.name}님, ${tile.name}을(를) ${nextLevelName}(으)로 지으시겠습니까? (${upgradeCost})`,
  };
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
  let bought = false;

  if (buy && tile.price !== null && currentPlayer.balance >= tile.price) {
    currentPlayer.balance -= tile.price;
    tileOwners = [...tileOwners];
    tileOwners[tileIdx] = currentPlayer.id;
    notice = `${currentPlayer.name}님이 ${tile.name}을 구매했습니다.`;
    bought = true;
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

  if (bought) {
    return offerInitialBuild(resolvedState, tileIdx);
  }
  return finishTurnStep(resolvedState, state.isDoubleRoll);
}

function handleDecideBuild(state: GameState, build: boolean): GameState {
  const isInitial = state.phase === 'awaiting-initial-build-decision';
  const isRevisit = state.phase === 'awaiting-build-decision';
  if ((!isInitial && !isRevisit) || state.pendingPurchaseTileIdx === null) {
    return state;
  }

  const tileIdx = state.pendingPurchaseTileIdx;
  const tile = BOARD[tileIdx];
  const players = state.players.map((p) => ({ ...p }));
  const currentPlayer = players[state.currentPlayerIndex];
  let tileLevels = state.tileLevels;
  let notice: string;
  let built = false;

  const currentLevel = tileLevels[tileIdx];
  const upgradeCost = Math.round((tile.price ?? 0) * BUILDING_UPGRADE_COST_RATIOS[currentLevel]);

  if (build && currentPlayer.balance >= upgradeCost) {
    currentPlayer.balance -= upgradeCost;
    tileLevels = [...tileLevels];
    tileLevels[tileIdx] += 1;
    notice = `${currentPlayer.name}님이 ${tile.name}을(를) ${BUILDING_LEVEL_NAMES[tileLevels[tileIdx]]}(으)로 업그레이드했습니다.`;
    built = true;
  } else {
    notice = `${currentPlayer.name}님이 ${tile.name} 건물을 업그레이드하지 않았습니다.`;
  }

  const resolvedState: GameState = {
    ...state,
    players,
    tileLevels,
    phase: 'awaiting-roll',
    pendingPurchaseTileIdx: null,
    notice,
  };

  if (isInitial && built) {
    return offerInitialBuild(resolvedState, tileIdx);
  }
  return finishTurnStep(resolvedState, state.isDoubleRoll);
}

/** 자기 턴이든 남의 턴이든 언제나 낼 수 있는 포기. 파산과 동일하게 취급한다.
 * 포기한 사람이 지금 턴인 사람이면 대기 중이던 구매 결정 등은 취소하고 턴을 넘긴다.
 * 남의 턴에 포기했으면 그 사람만 탈락 처리하고 진행 중이던 턴은 그대로 이어간다. */
function handleForfeit(state: GameState, playerId: string): GameState {
  if (state.phase === 'game-over') return state;

  const players = state.players.map((p) => ({ ...p }));
  const target = players.find((p) => p.id === playerId);
  if (!target || target.isBankrupt) return state;

  target.isBankrupt = true;
  target.balance = 0;
  const notice = `${target.name}님이 게임을 포기했습니다.`;

  const isCurrentPlayer = players[state.currentPlayerIndex].id === playerId;

  if (!isCurrentPlayer) {
    const alive = players.filter((p) => !p.isBankrupt);
    if (alive.length <= 1) {
      return { ...state, players, notice, phase: 'game-over', winnerId: alive[0]?.id ?? null };
    }
    return { ...state, players, notice };
  }

  const stateAfterForfeit: GameState = {
    ...state,
    players,
    notice,
    phase: 'awaiting-roll',
    pendingPurchaseTileIdx: null,
  };

  return finishTurnStep(stateAfterForfeit, false);
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
