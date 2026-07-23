import { BOARD } from './board.ts';
import { BUILDING_UPGRADE_COST_RATIOS, MAX_BUILDING_LEVEL } from './config.ts';
import type { GameState } from './types.ts';

/** 다음 레벨로 올리는 데 드는 건설비. 이미 최고 레벨이면 null(더 지을 수 없음). */
export function getUpgradeCost(tileIdx: number, level: number): number | null {
  if (level >= MAX_BUILDING_LEVEL) return null;
  const tile = BOARD[tileIdx];
  return Math.round((tile.price ?? 0) * BUILDING_UPGRADE_COST_RATIOS[level]);
}

/** 특정 칸을 지금 잔액으로 업그레이드할 수 있는지 (레벨 MAX 여부 + 비용 감당 여부). */
export function canAffordUpgrade(tileIdx: number, level: number, balance: number): boolean {
  const cost = getUpgradeCost(tileIdx, level);
  return cost !== null && balance >= cost;
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
