import { TILE_FLAGS } from '../game/board';
import { getCurrentToll } from '../game/buildings';
import type { PlayerColor, Tile as TileData } from '../game/types';

interface TileProps {
  tile: TileData;
  ownerColor: PlayerColor | null;
  level?: number;
  /** 출발점 보너스 등에서 "이 칸을 고를 수 있음"을 표시할 때 사용 */
  selectable?: boolean;
  selectHint?: string;
  onSelect?: () => void;
}

/** 레벨별 상단 건물 아이콘 — 실제 픽셀아트 에셋 준비 전까지의 자리표시자(placeholder).
 * 나중에 이 자리를 이미지 스프라이트로 교체하면 됨(레이아웃 구조는 이미 완성). */
function buildingIcon(level: number): string | null {
  if (level >= 4) return '🏨';
  if (level === 3) return '🏢';
  if (level >= 1) return '🏠';
  return null;
}

export function Tile({ tile, ownerColor, level = 0, selectable = false, selectHint, onSelect }: TileProps) {
  const label = tile.type === 'start' ? '출발' : tile.type === 'jail' ? '무인도' : tile.name;
  const isLand = tile.type === 'empty_land' || tile.type === 'landmark';
  const owned = ownerColor !== null;
  const flag = TILE_FLAGS[tile.idx];
  // 주인이 없으면 땅값(구매가), 있으면 지금 등급 기준 통행료 — 건물 유무와 무관하게
  // "이미 팔린 땅이니 살 수 없다"는 가격보다 "지금 내야 할 돈"이 더 유용한 정보라 통일함.
  const value = isLand ? (owned ? getCurrentToll(tile.idx, level) : tile.price) : null;

  return (
    <div
      className={`tile tile--${tile.type}${selectable ? ' tile--selectable' : ''}`}
      style={ownerColor ? { borderColor: `var(--color-${ownerColor})` } : undefined}
      title={selectable ? selectHint : undefined}
      onClick={selectable ? onSelect : undefined}
    >
      {isLand ? (
        <>
          <div className="tile-top">{buildingIcon(level)}</div>
          <div className="tile-body">
            <span className="tile-label">{label}</span>
            {flag && (
              <span className="tile-flag-box">
                <span className="tile-flag">{flag}</span>
              </span>
            )}
            {value !== null && <span className="tile-value">{value}</span>}
          </div>
        </>
      ) : (
        <span className="tile-label">{label}</span>
      )}
    </div>
  );
}
