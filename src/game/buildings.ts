import { BOARD } from './board.ts';
import {
  BUILDING_SALE_RATIO,
  BUILDING_TOLL_LEVEL_MULTIPLIERS,
  LAND_SALE_RATIO,
  MAX_BUILDING_LEVEL,
  ZONE_BUILD_COST,
} from './config.ts';
import type { GameState } from './types.ts';

/** 그 칸에 지금 도착하면 내야 할 통행료(landmark는 고정값, 그 외엔 등급별 배율 적용) —
 * 유일한 계산 지점. engine.ts의 실제 징수와 Tile.tsx의 표시 둘 다 이 함수를 통해야 한다. */
export function getCurrentToll(tileIdx: number, level: number): number {
  const tile = BOARD[tileIdx];
  return (tile.toll ?? 0) * BUILDING_TOLL_LEVEL_MULTIPLIERS[level];
}

/** 다음 레벨로 올리는 데 드는 건설비. landmark는 건물 자체가 불가능해 항상 null.
 * 이미 최고 레벨이어도 null(더 지을 수 없음). 건설비는 땅값이 아니라 구역별 고정값
 * (ZONE_BUILD_COST, CLAUDE.md "건설비: 구역별 고정" 참고) — 별장1/별장2(level 0,1)는 같은 금액. */
export function getUpgradeCost(tileIdx: number, level: number): number | null {
  const tile = BOARD[tileIdx];
  if (tile.type === 'landmark') return null;
  if (level >= MAX_BUILDING_LEVEL) return null;
  const zone = ZONE_BUILD_COST[Math.floor(tileIdx / 10)];
  if (level === 0 || level === 1) return zone.villa;
  if (level === 2) return zone.building;
  return zone.hotel;
}

/** 특정 칸을 지금 잔액으로 업그레이드할 수 있는지 (레벨 MAX 여부 + 비용 감당 여부). */
export function canAffordUpgrade(tileIdx: number, level: number, balance: number): boolean {
  const cost = getUpgradeCost(tileIdx, level);
  return cost !== null && balance >= cost;
}

/** fromLevel에서 잔액이 허용하는 데까지 몇 레벨까지 갈 수 있는지 (최초구매 즉시건축 등급 선택지 계산용). */
export function getMaxAffordableLevel(tileIdx: number, fromLevel: number, balance: number): number {
  let level = fromLevel;
  let remaining = balance;
  while (level < MAX_BUILDING_LEVEL) {
    const cost = getUpgradeCost(tileIdx, level);
    if (cost === null || remaining < cost) break;
    remaining -= cost;
    level += 1;
  }
  return level;
}

/** fromLevel -> toLevel까지 한 번에 지을 때 드는 총 건설비. */
export function getCumulativeUpgradeCost(tileIdx: number, fromLevel: number, toLevel: number): number {
  let total = 0;
  for (let level = fromLevel; level < toLevel; level += 1) {
    total += getUpgradeCost(tileIdx, level) ?? 0;
  }
  return total;
}

/** 출발칸 정확 도착 보너스 대상: 이 플레이어가 소유 + 레벨 MAX 미만 + 지금 잔액으로 감당되는 땅. */
export function getStartBonusEligibleTiles(state: GameState, playerId: string): number[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  const eligible: number[] = [];
  for (let idx = 0; idx < state.tileOwners.length; idx += 1) {
    if (state.tileOwners[idx] !== playerId) continue;
    if (canAffordUpgrade(idx, state.tileLevels[idx], player.balance)) {
      eligible.push(idx);
    }
  }
  return eligible;
}

/** 그 칸의 건물을 한 단계 낮출 때(레벨 -1) 돌려받는 금액 = 그 레벨을 지을 때 낸 건설비 * BUILDING_SALE_RATIO. */
export function getBuildingSaleValue(tileIdx: number, level: number): number {
  if (level <= 0) return 0;
  const constructionCost = getUpgradeCost(tileIdx, level - 1) ?? 0;
  return Math.round(constructionCost * BUILDING_SALE_RATIO);
}

/** 땅 자체를 팔 때 돌려받는 금액. */
export function getLandSaleValue(tileIdx: number): number {
  const tile = BOARD[tileIdx];
  return Math.round((tile.price ?? 0) * LAND_SALE_RATIO);
}

export interface LiquidationResult {
  tileOwners: (string | null)[];
  tileLevels: number[];
  balance: number;
  buildingsSold: number;
  landsSold: number;
}

/** 통행료 등 빚을 갚을 돈이 부족할 때 낮은 등급 건물부터, 그다음 싼 땅부터 자동으로 팔아 충당한다.
 * 플레이어에게 뭘 팔지 묻지 않는다(방치형이라 자동 기본값으로 처리) — CLAUDE.md "매각 & 파산" 참고. */
export function liquidateForDebt(
  tileOwners: (string | null)[],
  tileLevels: number[],
  playerId: string,
  balance: number,
  amountNeeded: number,
): LiquidationResult {
  let newTileOwners = tileOwners;
  let newTileLevels = tileLevels;
  let newBalance = balance;
  let buildingsSold = 0;
  let landsSold = 0;

  const ownedIndices = () =>
    newTileOwners
      .map((owner, idx) => (owner === playerId ? idx : -1))
      .filter((idx) => idx !== -1);

  while (newBalance < amountNeeded) {
    const candidates = ownedIndices()
      .filter((idx) => newTileLevels[idx] > 0)
      .sort((a, b) => newTileLevels[a] - newTileLevels[b] || (BOARD[a].price ?? 0) - (BOARD[b].price ?? 0));
    if (candidates.length === 0) break;

    const idx = candidates[0];
    const saleValue = getBuildingSaleValue(idx, newTileLevels[idx]);
    newTileLevels = [...newTileLevels];
    newTileLevels[idx] -= 1;
    newBalance += saleValue;
    buildingsSold += 1;
  }

  while (newBalance < amountNeeded) {
    const candidates = ownedIndices()
      .filter((idx) => newTileLevels[idx] === 0)
      .sort((a, b) => (BOARD[a].price ?? 0) - (BOARD[b].price ?? 0));
    if (candidates.length === 0) break;

    const idx = candidates[0];
    const saleValue = getLandSaleValue(idx);
    newTileOwners = [...newTileOwners];
    newTileOwners[idx] = null;
    newBalance += saleValue;
    landsSold += 1;
  }

  return {
    tileOwners: newTileOwners,
    tileLevels: newTileLevels,
    balance: newBalance,
    buildingsSold,
    landsSold,
  };
}

/** 그 땅의 총 가치(땅값 + 지금까지 들어간 건설비 누적) — 반액대매출 카드에서 "가장 비싼 땅"을 정할 때 사용. */
export function getPropertyValue(tileIdx: number, level: number): number {
  const tile = BOARD[tileIdx];
  let invested = 0;
  for (let l = 0; l < level; l += 1) {
    invested += getUpgradeCost(tileIdx, l) ?? 0;
  }
  return (tile.price ?? 0) + invested;
}

/** 그 플레이어가 소유한 땅 중 총 가치가 가장 큰 칸. 동률이면 idx가 낮은 쪽. 소유한 게 없으면 null. */
export function getMostValuableOwnedTile(
  tileOwners: (string | null)[],
  tileLevels: number[],
  playerId: string,
): number | null {
  let bestIdx: number | null = null;
  let bestValue = -1;

  for (let idx = 0; idx < tileOwners.length; idx += 1) {
    if (tileOwners[idx] !== playerId) continue;
    const value = getPropertyValue(idx, tileLevels[idx]);
    if (value > bestValue) {
      bestValue = value;
      bestIdx = idx;
    }
  }

  return bestIdx;
}
