import { BOARD } from './board.ts';
import {
  getCumulativeUpgradeCost,
  getCurrentToll,
  getMaxAffordableLevel,
  getMostValuableOwnedTile,
  getPropertyValue,
  getStartBonusEligibleTiles,
  getUpgradeCost,
  liquidateForDebt,
} from './buildings.ts';
import {
  BOARD_SIZE,
  BUILDING_LEVEL_NAMES,
  CONSECUTIVE_DOUBLES_LIMIT,
  DICE_SIDES,
  GOLDEN_KEY_DECK,
  JAIL_TILE_IDX,
  JAIL_TURNS,
  PLAYER_COLORS,
  SALARY_ON_PASS_START,
  START_TILE_IDX,
  STARTING_BALANCE,
  WELFARE_GET_TILE_IDX,
  WELFARE_PAY_AMOUNT,
} from './config.ts';
import type { GameAction, GameState, Player } from './types.ts';

function rollDie(): number {
  return Math.floor(Math.random() * DICE_SIDES) + 1;
}

/** 새로 셔플한 카드 순서(인덱스 배열)를 만든다. 주사위처럼 서버(Edge Function) 안에서만 실행되므로
 * 클라이언트가 다음 카드를 미리 알 수 없다. */
function shuffleDeck(size: number): number[] {
  const deck = Array.from({ length: size }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
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
    jailTurnsLeft: 0,
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
    eventDeck: [],
    welfarePool: 0,
    consecutiveDoubles: 0,
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
    case 'DECIDE_INITIAL_BUILD':
      return handleDecideInitialBuild(state, action.targetLevel);
    case 'DECIDE_START_BONUS_BUILD':
      return handleDecideStartBonusBuild(state, action.tileIdx);
    case 'DECIDE_SPACE_TRAVEL':
      return handleDecideSpaceTravel(state, action.tileIdx);
    case 'FORFEIT':
      return handleForfeit(state, action.playerId);
    default:
      return state;
  }
}

interface TileLandingResult {
  tileOwners: (string | null)[];
  tileLevels: number[];
  eventDeck: number[];
  welfarePool: number;
  phase: GameState['phase'];
  pendingPurchaseTileIdx: number | null;
  notice: string | null;
}

/** 어떤 칸에 도착했을 때의 효과(무인도/땅 구매·통행료·건물 업그레이드 프롬프트/출발점 보너스/황금열쇠)를 처리한다.
 * 주사위 이동뿐 아니라 황금열쇠 이동 카드가 옮긴 위치에서도 재사용한다(handleRollDice 참고).
 * isExactStartLanding: 출발칸 정확 도착 보너스 체크 여부.
 * allowEventDraw: false면 황금열쇠 칸에 도착해도 카드를 뽑지 않는다 — 이동 카드 자체 효과로 옮겨진
 * 2차 도착에서까지 재귀적으로 카드를 뽑는 걸 막기 위함(문서에 규정 없는 극단적 경우의 단순화). */
function resolveTileLanding(
  players: Player[],
  currentPlayer: Player,
  tileIdx: number,
  tileOwnersIn: (string | null)[],
  tileLevelsIn: number[],
  eventDeckIn: number[],
  welfarePoolIn: number,
  isExactStartLanding: boolean,
  allowEventDraw: boolean,
): TileLandingResult {
  const tile = BOARD[tileIdx];
  let tileOwners = tileOwnersIn;
  let tileLevels = tileLevelsIn;
  let eventDeck = eventDeckIn;
  let welfarePool = welfarePoolIn;
  let phase: GameState['phase'] = 'awaiting-roll';
  let pendingPurchaseTileIdx: number | null = null;
  let notice: string | null = null;

  if (tile.type === 'jail') {
    currentPlayer.jailTurnsLeft = JAIL_TURNS;
    notice = `${currentPlayer.name}님이 무인도에 도착해 ${JAIL_TURNS}턴을 쉽니다. (더블이 나오면 즉시 탈출)`;
  } else if (tile.type === 'empty_land' || tile.type === 'landmark') {
    const ownerId = tileOwners[tileIdx];
    const level = tileLevels[tileIdx];

    if (ownerId === currentPlayer.id) {
      const upgradeCost = getUpgradeCost(tileIdx, level);
      if (upgradeCost === null) {
        // 이미 최고 레벨: 아무 일도 일어나지 않음
      } else if (currentPlayer.balance < upgradeCost) {
        notice = `${currentPlayer.name}님이 ${tile.name} 건물을 올릴 돈이 없어 지나갑니다.`;
      } else {
        const nextLevelName = BUILDING_LEVEL_NAMES[level + 1];
        phase = 'awaiting-build-decision';
        pendingPurchaseTileIdx = tileIdx;
        notice = `${currentPlayer.name}님, ${tile.name}을(를) ${nextLevelName}(으)로 업그레이드하시겠습니까? (${upgradeCost})`;
      }
    } else if (ownerId) {
      const toll = getCurrentToll(tileIdx, level);
      let liquidationNotice = '';

      if (currentPlayer.balance < toll) {
        const liquidated = liquidateForDebt(
          tileOwners,
          tileLevels,
          currentPlayer.id,
          currentPlayer.balance,
          toll,
        );
        tileOwners = liquidated.tileOwners;
        tileLevels = liquidated.tileLevels;
        currentPlayer.balance = liquidated.balance;

        if (liquidated.buildingsSold > 0 || liquidated.landsSold > 0) {
          liquidationNotice = ` 자산을 매각했습니다 (건물 ${liquidated.buildingsSold}채, 땅 ${liquidated.landsSold}곳).`;
        }
      }

      if (currentPlayer.balance < toll) {
        currentPlayer.isBankrupt = true;
        currentPlayer.balance = 0;
        notice = `${currentPlayer.name}님이 가진 자산을 다 팔아도 통행료 ${toll}을 내지 못해 파산했습니다.${liquidationNotice}`;
      } else {
        currentPlayer.balance -= toll;
        const ownerIndex = players.findIndex((p) => p.id === ownerId);
        if (ownerIndex !== -1) {
          players[ownerIndex].balance += toll;
        }
        notice = `${currentPlayer.name}님이 ${tile.name} 통행료 ${toll}을 지불했습니다.${liquidationNotice}`;
      }
    } else if (currentPlayer.balance < (tile.price ?? 0)) {
      // 살 돈이 없으면 물어볼 필요 없이 그냥 지나감
      notice = `${currentPlayer.name}님이 ${tile.name}을(를) 살 돈이 없어 지나갑니다.`;
    } else {
      phase = 'awaiting-purchase-decision';
      pendingPurchaseTileIdx = tileIdx;
      notice = `${currentPlayer.name}님, ${tile.name}(${tile.price}) 구매하시겠습니까?`;
    }
  } else if (tile.type === 'start' && isExactStartLanding) {
    const eligibleTiles = getStartBonusEligibleTiles(
      { players, tileOwners, tileLevels } as GameState,
      currentPlayer.id,
    );
    if (eligibleTiles.length > 0) {
      phase = 'awaiting-start-bonus-build';
      notice = `${currentPlayer.name}님이 출발점에 정확히 도착했습니다! 업그레이드할 땅을 골라주세요.`;
    }
  } else if (tile.type === 'event') {
    if (!allowEventDraw) {
      notice = `${currentPlayer.name}님이 황금열쇠 칸에 도착했지만 카드는 뽑지 않습니다.`;
    } else {
      if (eventDeck.length === 0) {
        eventDeck = shuffleDeck(GOLDEN_KEY_DECK.length);
      }
      const [cardIdx, ...restDeck] = eventDeck;
      const card = GOLDEN_KEY_DECK[cardIdx];
      eventDeck = restDeck;

      if (card.type === 'prize') {
        currentPlayer.balance += card.amount ?? 0;
        notice = `${currentPlayer.name}님이 황금열쇠(${card.label})로 ${card.amount}을 받았습니다.`;
      } else if (card.type === 'fine') {
        const amount = card.amount ?? 0;
        let liquidationNotice = '';
        if (currentPlayer.balance < amount) {
          const liquidated = liquidateForDebt(tileOwners, tileLevels, currentPlayer.id, currentPlayer.balance, amount);
          tileOwners = liquidated.tileOwners;
          tileLevels = liquidated.tileLevels;
          currentPlayer.balance = liquidated.balance;
          if (liquidated.buildingsSold > 0 || liquidated.landsSold > 0) {
            liquidationNotice = ` 자산을 매각했습니다 (건물 ${liquidated.buildingsSold}채, 땅 ${liquidated.landsSold}곳).`;
          }
        }
        if (currentPlayer.balance < amount) {
          currentPlayer.isBankrupt = true;
          currentPlayer.balance = 0;
          notice = `${currentPlayer.name}님이 황금열쇠(${card.label})로 ${amount}을 내야 했지만 가진 자산을 다 팔아도 못 내 파산했습니다.${liquidationNotice}`;
        } else {
          currentPlayer.balance -= amount;
          notice = `${currentPlayer.name}님이 황금열쇠(${card.label})로 ${amount}을 냈습니다.${liquidationNotice}`;
        }
      } else if (card.type === 'birthday') {
        const amount = card.amount ?? 0;
        let collected = 0;
        for (const other of players) {
          if (other.id === currentPlayer.id || other.isBankrupt) continue;
          const paid = Math.min(other.balance, amount);
          other.balance -= paid;
          collected += paid;
        }
        currentPlayer.balance += collected;
        notice = `${currentPlayer.name}님이 황금열쇠(${card.label})로 다른 플레이어들에게서 ${collected}을 받았습니다.`;
      } else if (card.type === 'building_upkeep') {
        const rates = card.rates!;
        let total = 0;
        for (let idx = 0; idx < tileOwners.length; idx += 1) {
          if (tileOwners[idx] !== currentPlayer.id) continue;
          const level = tileLevels[idx];
          if (level === 1 || level === 2) total += rates.villa;
          else if (level === 3) total += rates.building;
          else if (level === 4) total += rates.hotel;
        }

        let liquidationNotice = '';
        if (total > 0 && currentPlayer.balance < total) {
          const liquidated = liquidateForDebt(tileOwners, tileLevels, currentPlayer.id, currentPlayer.balance, total);
          tileOwners = liquidated.tileOwners;
          tileLevels = liquidated.tileLevels;
          currentPlayer.balance = liquidated.balance;
          if (liquidated.buildingsSold > 0 || liquidated.landsSold > 0) {
            liquidationNotice = ` 자산을 매각했습니다 (건물 ${liquidated.buildingsSold}채, 땅 ${liquidated.landsSold}곳).`;
          }
        }

        if (total > 0 && currentPlayer.balance < total) {
          currentPlayer.isBankrupt = true;
          currentPlayer.balance = 0;
          notice = `${currentPlayer.name}님이 황금열쇠(${card.label})로 ${total}을 내야 했지만 가진 자산을 다 팔아도 못 내 파산했습니다.${liquidationNotice}`;
        } else {
          currentPlayer.balance -= total;
          notice = `${currentPlayer.name}님이 황금열쇠(${card.label})로 ${total}을 냈습니다.${liquidationNotice}`;
        }
      } else if (card.type === 'forced_sale') {
        const targetIdx = getMostValuableOwnedTile(tileOwners, tileLevels, currentPlayer.id);
        if (targetIdx === null) {
          notice = `${currentPlayer.name}님이 황금열쇠(${card.label})를 뽑았지만 매각할 땅이 없습니다.`;
        } else {
          const tileName = BOARD[targetIdx].name;
          const value = getPropertyValue(targetIdx, tileLevels[targetIdx]);
          const refund = Math.round(value / 2);
          currentPlayer.balance += refund;
          tileOwners = [...tileOwners];
          tileLevels = [...tileLevels];
          tileOwners[targetIdx] = null;
          tileLevels[targetIdx] = 0;
          notice = `${currentPlayer.name}님이 황금열쇠(${card.label})로 ${tileName}을(를) 은행에 반값(${refund})에 매각했습니다.`;
        }
      } else {
        // move_to_start / move_to_jail / move_back / move_to_welfare_get: 이동 후 도착한 칸의 정상 효과까지 이어서 처리.
        const targetPos =
          card.type === 'move_to_start'
            ? START_TILE_IDX
            : card.type === 'move_to_jail'
              ? JAIL_TILE_IDX
              : card.type === 'move_to_welfare_get'
                ? WELFARE_GET_TILE_IDX
                : (((currentPlayer.position - (card.tiles ?? 0)) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;

        if (card.type === 'move_to_start') {
          currentPlayer.balance += SALARY_ON_PASS_START;
        } else if (card.type === 'move_to_welfare_get' && targetPos < currentPlayer.position) {
          // 앞으로 걸어가다 출발점을 지나친 경우(무인도행만 예외, 문서의 일반 이동 카드 규칙)
          currentPlayer.balance += SALARY_ON_PASS_START;
        }
        currentPlayer.position = targetPos;

        const moveResult = resolveTileLanding(
          players,
          currentPlayer,
          targetPos,
          tileOwners,
          tileLevels,
          eventDeck,
          welfarePool,
          card.type === 'move_to_start',
          false,
        );
        tileOwners = moveResult.tileOwners;
        tileLevels = moveResult.tileLevels;
        eventDeck = moveResult.eventDeck;
        welfarePool = moveResult.welfarePool;
        phase = moveResult.phase;
        pendingPurchaseTileIdx = moveResult.pendingPurchaseTileIdx;
        notice = moveResult.notice
          ? `${currentPlayer.name}님이 황금열쇠(${card.label})! ${moveResult.notice}`
          : `${currentPlayer.name}님이 황금열쇠(${card.label})로 이동했습니다.`;
      }
    }
  } else if (tile.type === 'welfare_pay') {
    let liquidationNotice = '';
    if (currentPlayer.balance < WELFARE_PAY_AMOUNT) {
      const liquidated = liquidateForDebt(
        tileOwners,
        tileLevels,
        currentPlayer.id,
        currentPlayer.balance,
        WELFARE_PAY_AMOUNT,
      );
      tileOwners = liquidated.tileOwners;
      tileLevels = liquidated.tileLevels;
      currentPlayer.balance = liquidated.balance;
      if (liquidated.buildingsSold > 0 || liquidated.landsSold > 0) {
        liquidationNotice = ` 자산을 매각했습니다 (건물 ${liquidated.buildingsSold}채, 땅 ${liquidated.landsSold}곳).`;
      }
    }

    if (currentPlayer.balance < WELFARE_PAY_AMOUNT) {
      currentPlayer.isBankrupt = true;
      currentPlayer.balance = 0;
      notice = `${currentPlayer.name}님이 가진 자산을 다 팔아도 복지기금 ${WELFARE_PAY_AMOUNT}을 내지 못해 파산했습니다.${liquidationNotice}`;
    } else {
      currentPlayer.balance -= WELFARE_PAY_AMOUNT;
      welfarePool += WELFARE_PAY_AMOUNT;
      notice = `${currentPlayer.name}님이 사회복지기금에 ${WELFARE_PAY_AMOUNT}을 납부했습니다. (누적 ${welfarePool})${liquidationNotice}`;
    }
  } else if (tile.type === 'welfare_get') {
    if (welfarePool > 0) {
      currentPlayer.balance += welfarePool;
      notice = `${currentPlayer.name}님이 사회복지기금 ${welfarePool}을 수령했습니다.`;
      welfarePool = 0;
    } else {
      notice = `${currentPlayer.name}님이 사회복지기금 접수처에 도착했지만 적립된 기금이 없습니다.`;
    }
  } else if (tile.type === 'space_travel') {
    phase = 'awaiting-space-travel-destination';
    notice = `${currentPlayer.name}님이 우주여행 칸에 도착했습니다! 이동할 칸을 골라주세요.`;
  }

  return { tileOwners, tileLevels, eventDeck, welfarePool, phase, pendingPurchaseTileIdx, notice };
}

/** 무인도 대기 중인 플레이어가 자기 턴에 주사위를 굴렀을 때의 처리.
 * 더블이면 즉시 탈출, 아니면 대기 턴을 하나 줄이고(3번째 실패면 그대로 강제 석방) 이동한다.
 * 탈출/석방 이동은 resolveTileLanding을 재사용해 도착 칸 효과를 정상 적용하되, 보너스 재굴림은 절대 없다. */
function handleJailRoll(
  state: GameState,
  players: Player[],
  currentPlayer: Player,
  d1: number,
  d2: number,
  isDouble: boolean,
): GameState {
  if (!isDouble) {
    currentPlayer.jailTurnsLeft -= 1;
    if (currentPlayer.jailTurnsLeft > 0) {
      return finishTurnStep(
        {
          ...state,
          players,
          lastRoll: [d1, d2],
          isDoubleRoll: false,
          consecutiveDoubles: 0,
          notice: `${currentPlayer.name}님이 무인도에서 대기 중입니다. (남은 턴 ${currentPlayer.jailTurnsLeft})`,
        },
        false,
      );
    }
  }

  const escapeNotice = isDouble
    ? `${currentPlayer.name}님이 더블을 굴려 무인도에서 탈출했습니다!`
    : `${currentPlayer.name}님이 무인도 대기가 끝나 나왔습니다.`;

  currentPlayer.jailTurnsLeft = 0;

  const sum = d1 + d2;
  const rawNewPos = currentPlayer.position + sum;
  const wrapped = rawNewPos >= BOARD_SIZE;
  const newPos = rawNewPos % BOARD_SIZE;
  currentPlayer.position = newPos;

  let salaryNotice = '';
  if (wrapped) {
    currentPlayer.balance += SALARY_ON_PASS_START;
    salaryNotice = ` 출발지를 지나 월급 ${SALARY_ON_PASS_START}을 받았습니다.`;
  }

  const landing = resolveTileLanding(
    players,
    currentPlayer,
    newPos,
    state.tileOwners,
    state.tileLevels,
    state.eventDeck,
    state.welfarePool,
    wrapped && newPos === START_TILE_IDX,
    true,
  );

  const rolledState: GameState = {
    ...state,
    players,
    tileOwners: landing.tileOwners,
    tileLevels: landing.tileLevels,
    eventDeck: landing.eventDeck,
    welfarePool: landing.welfarePool,
    lastRoll: [d1, d2],
    isDoubleRoll: false,
    consecutiveDoubles: 0,
    phase: landing.phase,
    pendingPurchaseTileIdx: landing.pendingPurchaseTileIdx,
    notice: landing.notice ? `${escapeNotice} ${landing.notice}` : `${escapeNotice}${salaryNotice}`,
  };

  if (
    rolledState.phase === 'awaiting-purchase-decision' ||
    rolledState.phase === 'awaiting-build-decision' ||
    rolledState.phase === 'awaiting-start-bonus-build' ||
    rolledState.phase === 'awaiting-space-travel-destination'
  ) {
    return rolledState;
  }

  return finishTurnStep(rolledState, false);
}

function handleRollDice(state: GameState): GameState {
  if (state.phase !== 'awaiting-roll') return state;

  const d1 = rollDie();
  const d2 = rollDie();
  const isDouble = d1 === d2;
  const sum = d1 + d2;

  const players = state.players.map((p) => ({ ...p }));
  const currentPlayer = players[state.currentPlayerIndex];

  if (currentPlayer.jailTurnsLeft > 0) {
    return handleJailRoll(state, players, currentPlayer, d1, d2, isDouble);
  }

  const newConsecutiveDoubles = isDouble ? state.consecutiveDoubles + 1 : 0;

  if (newConsecutiveDoubles >= CONSECUTIVE_DOUBLES_LIMIT) {
    // 더블 3연속: 텔레포트라 이동 도중 출발점을 "지나치는" 개념 자체가 없음 -> 월급 없음(CLAUDE.md 명시).
    currentPlayer.position = JAIL_TILE_IDX;
    currentPlayer.jailTurnsLeft = JAIL_TURNS;
    return finishTurnStep(
      {
        ...state,
        players,
        lastRoll: [d1, d2],
        isDoubleRoll: false,
        consecutiveDoubles: 0,
        phase: 'awaiting-roll',
        notice: `${currentPlayer.name}님이 더블을 ${CONSECUTIVE_DOUBLES_LIMIT}번 연속 굴려 무인도로 강제 이동되었습니다.`,
      },
      false,
    );
  }

  const rawNewPos = currentPlayer.position + sum;
  const wrapped = rawNewPos >= BOARD_SIZE;
  const newPos = rawNewPos % BOARD_SIZE;
  currentPlayer.position = newPos;

  let notice: string | null = null;

  if (wrapped) {
    currentPlayer.balance += SALARY_ON_PASS_START;
    notice = `${currentPlayer.name}님이 출발지를 지나 월급 ${SALARY_ON_PASS_START}을 받았습니다.`;
  }

  const landing = resolveTileLanding(
    players,
    currentPlayer,
    newPos,
    state.tileOwners,
    state.tileLevels,
    state.eventDeck,
    state.welfarePool,
    wrapped && newPos === START_TILE_IDX,
    true,
  );

  // 방금 이 착지(직접 도착 또는 황금열쇠 이동 카드)로 무인도에 막 들어갔다면, 원래 이 턴은 일반
  // 더블 재굴림 대상이 아니었으므로 보너스 재굴림/연속더블 카운트를 강제로 지운다.
  const justEnteredJail = currentPlayer.jailTurnsLeft > 0;

  const rolledState: GameState = {
    ...state,
    players,
    tileOwners: landing.tileOwners,
    tileLevels: landing.tileLevels,
    eventDeck: landing.eventDeck,
    welfarePool: landing.welfarePool,
    lastRoll: [d1, d2],
    isDoubleRoll: justEnteredJail ? false : isDouble,
    consecutiveDoubles: justEnteredJail ? 0 : newConsecutiveDoubles,
    phase: landing.phase,
    pendingPurchaseTileIdx: landing.pendingPurchaseTileIdx,
    notice: landing.notice ?? notice,
  };

  if (
    landing.phase === 'awaiting-purchase-decision' ||
    landing.phase === 'awaiting-build-decision' ||
    landing.phase === 'awaiting-start-bonus-build' ||
    landing.phase === 'awaiting-space-travel-destination'
  ) {
    return rolledState;
  }

  return finishTurnStep(rolledState, rolledState.isDoubleRoll);
}

/** 최초 구매 직후 감당되는 최고 등급까지 한 번에 골라 지을 수 있게 프롬프트를 띄우는 헬퍼(handleDecidePurchase 전용).
 * 재방문 업그레이드(awaiting-build-decision)는 한 번에 한 단계로 고정이라 이 헬퍼를 쓰지 않는다. */
function offerInitialBuild(state: GameState, tileIdx: number): GameState {
  const tile = BOARD[tileIdx];
  const currentPlayer = state.players[state.currentPlayerIndex];
  const level = state.tileLevels[tileIdx];

  const maxLevel = getMaxAffordableLevel(tileIdx, level, currentPlayer.balance);
  if (maxLevel === level) {
    return finishTurnStep(state, state.isDoubleRoll);
  }

  return {
    ...state,
    phase: 'awaiting-initial-build-decision',
    pendingPurchaseTileIdx: tileIdx,
    notice: `${currentPlayer.name}님, ${tile.name}을(를) 구매했습니다! 원하는 등급까지 지어보세요 (최대 ${BUILDING_LEVEL_NAMES[maxLevel]}).`,
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

/** 재방문 업그레이드 전용(한 번에 한 단계, Y/N). 최초구매 즉시건축은 handleDecideInitialBuild가 담당. */
function handleDecideBuild(state: GameState, build: boolean): GameState {
  if (state.phase !== 'awaiting-build-decision' || state.pendingPurchaseTileIdx === null) {
    return state;
  }

  const tileIdx = state.pendingPurchaseTileIdx;
  const tile = BOARD[tileIdx];
  const players = state.players.map((p) => ({ ...p }));
  const currentPlayer = players[state.currentPlayerIndex];
  let tileLevels = state.tileLevels;
  let notice: string;

  const currentLevel = tileLevels[tileIdx];
  const upgradeCost = getUpgradeCost(tileIdx, currentLevel);

  if (build && upgradeCost !== null && currentPlayer.balance >= upgradeCost) {
    currentPlayer.balance -= upgradeCost;
    tileLevels = [...tileLevels];
    tileLevels[tileIdx] += 1;
    notice = `${currentPlayer.name}님이 ${tile.name}을(를) ${BUILDING_LEVEL_NAMES[tileLevels[tileIdx]]}(으)로 업그레이드했습니다.`;
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

  return finishTurnStep(resolvedState, state.isDoubleRoll);
}

/** 최초구매 즉시건축: 감당되는 데까지 원하는 등급을 한 번에 선택. 클라이언트가 보낸 targetLevel을
 * 그대로 믿지 않고 서버가 다시 감당 가능한 최고 레벨로 클램프한다. */
function handleDecideInitialBuild(state: GameState, targetLevel: number): GameState {
  if (state.phase !== 'awaiting-initial-build-decision' || state.pendingPurchaseTileIdx === null) {
    return state;
  }

  const tileIdx = state.pendingPurchaseTileIdx;
  const tile = BOARD[tileIdx];
  const players = state.players.map((p) => ({ ...p }));
  const currentPlayer = players[state.currentPlayerIndex];
  let tileLevels = state.tileLevels;
  let notice: string;

  const currentLevel = tileLevels[tileIdx];
  const maxLevel = getMaxAffordableLevel(tileIdx, currentLevel, currentPlayer.balance);
  const clampedTarget = Number.isInteger(targetLevel)
    ? Math.max(currentLevel, Math.min(targetLevel, maxLevel))
    : currentLevel;

  if (clampedTarget > currentLevel) {
    const cost = getCumulativeUpgradeCost(tileIdx, currentLevel, clampedTarget);
    currentPlayer.balance -= cost;
    tileLevels = [...tileLevels];
    tileLevels[tileIdx] = clampedTarget;
    notice = `${currentPlayer.name}님이 ${tile.name}을(를) ${BUILDING_LEVEL_NAMES[clampedTarget]}(으)로 지었습니다. (건설비 ${cost})`;
  } else {
    notice = `${currentPlayer.name}님이 ${tile.name}에 건물을 짓지 않았습니다.`;
  }

  const resolvedState: GameState = {
    ...state,
    players,
    tileLevels,
    phase: 'awaiting-roll',
    pendingPurchaseTileIdx: null,
    notice,
  };

  return finishTurnStep(resolvedState, state.isDoubleRoll);
}

/** 출발점 정확 도착 보너스: 소유한 땅 중 하나를 골라 한 등급 올린다. tileIdx가 null이면 건너뛰기.
 * 클라이언트가 보낸 tileIdx를 그대로 믿지 않고 소유주/레벨/잔액을 서버가 다시 검증한다 —
 * 유효하지 않으면(레이스 컨디션 등) 에러 없이 조용히 스킵한다(보너스라 실패해도 진행이 막히면 안 됨). */
function handleDecideStartBonusBuild(state: GameState, tileIdx: number | null): GameState {
  if (state.phase !== 'awaiting-start-bonus-build') return state;

  if (tileIdx === null) {
    return finishTurnStep({ ...state, phase: 'awaiting-roll' }, state.isDoubleRoll);
  }

  const players = state.players.map((p) => ({ ...p }));
  const currentPlayer = players[state.currentPlayerIndex];
  const level = state.tileLevels[tileIdx];
  const upgradeCost = getUpgradeCost(tileIdx, level);

  let tileLevels = state.tileLevels;
  let notice = state.notice;

  if (state.tileOwners[tileIdx] === currentPlayer.id && upgradeCost !== null && currentPlayer.balance >= upgradeCost) {
    const tile = BOARD[tileIdx];
    currentPlayer.balance -= upgradeCost;
    tileLevels = [...tileLevels];
    tileLevels[tileIdx] += 1;
    notice = `${currentPlayer.name}님이 출발점 보너스로 ${tile.name}을(를) ${BUILDING_LEVEL_NAMES[tileLevels[tileIdx]]}(으)로 업그레이드했습니다.`;
  }

  const resolvedState: GameState = {
    ...state,
    players,
    tileLevels,
    phase: 'awaiting-roll',
    notice,
  };

  return finishTurnStep(resolvedState, state.isDoubleRoll);
}

/** 우주여행: 보드의 원하는 칸으로 이동(텔레포트가 아니라 트랙을 따라 전진하는 판정이라 출발점을
 * 지나치면 월급). 도착한 칸의 정상 효과가 이어지고, 이동 후엔 더블이어도 재굴림 없이 턴 종료.
 * tileIdx가 null이거나 현재 위치·우주여행 칸 자체를 가리키면(서버 재검증, 클라이언트 신뢰 안 함)
 * 이동 없이 그 자리에서 턴을 넘긴다. */
function handleDecideSpaceTravel(state: GameState, tileIdx: number | null): GameState {
  if (state.phase !== 'awaiting-space-travel-destination') return state;

  const players = state.players.map((p) => ({ ...p }));
  const currentPlayer = players[state.currentPlayerIndex];

  const invalid =
    tileIdx === null || tileIdx === currentPlayer.position || BOARD[tileIdx].type === 'space_travel';

  if (invalid) {
    const notice = `${currentPlayer.name}님이 우주여행을 하지 않았습니다.`;
    return finishTurnStep({ ...state, players, phase: 'awaiting-roll', isDoubleRoll: false, notice }, false);
  }

  const wrapped = tileIdx < currentPlayer.position;
  if (wrapped) {
    currentPlayer.balance += SALARY_ON_PASS_START;
  }
  currentPlayer.position = tileIdx;

  const landing = resolveTileLanding(
    players,
    currentPlayer,
    tileIdx,
    state.tileOwners,
    state.tileLevels,
    state.eventDeck,
    state.welfarePool,
    tileIdx === START_TILE_IDX,
    true,
  );

  const resolvedState: GameState = {
    ...state,
    players,
    tileOwners: landing.tileOwners,
    tileLevels: landing.tileLevels,
    eventDeck: landing.eventDeck,
    welfarePool: landing.welfarePool,
    // 이동 후엔 더블이어도 재굴림 없음(문서 명시) — 도착한 칸이 또 구매/건축 프롬프트를 띄워
    // 그 결정이 나중에 finishTurnStep(state.isDoubleRoll)로 이어지는 경우까지 포함해 확실히 막는다.
    isDoubleRoll: false,
    phase: landing.phase,
    pendingPurchaseTileIdx: landing.pendingPurchaseTileIdx,
    notice: landing.notice,
  };

  if (
    resolvedState.phase === 'awaiting-purchase-decision' ||
    resolvedState.phase === 'awaiting-build-decision' ||
    resolvedState.phase === 'awaiting-start-bonus-build'
  ) {
    return resolvedState;
  }

  return finishTurnStep(resolvedState, false);
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

    break;
  }

  return {
    ...state,
    players,
    currentPlayerIndex: candidateIndex,
    phase: 'awaiting-roll',
    turnNumber: state.turnNumber + 1,
    consecutiveDoubles: 0,
  };
}
