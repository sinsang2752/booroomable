import { TILE_FLAGS, TILE_GROUP_COLOR } from '../game/board';
import { getCurrentToll } from '../game/buildings';
import { FLAG_ASSET_URLS } from '../game/flagAssets';
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

/** 레벨별 상단 건물 아이콘(이모지). level 1·2=별장(같은 이모지), 3=빌딩, 4=호텔. */
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
          <div
            className="tile-top"
            // empty_land만 파스텔 그룹색(랜드마크는 .tile--landmark .tile-top 금색 유지, 특수칸은 tile-top 없음).
            style={tile.type === 'empty_land' ? { background: TILE_GROUP_COLOR[tile.idx] } : undefined}
          >
            {buildingIcon(level)}
          </div>
          <div className="tile-body">
            <span className="tile-label">{label}</span>
            {flag && (
              <span className="tile-flag-box">
                <span
                  className="tile-flag"
                  // 인라인(개발 모드)으로 번들된 국기는 data:image/svg+xml,...URI라 내부에
                  // 홑따옴표(')가 그대로 들어있다 — url() 안을 따옴표 없이 쓰면 그 홑따옴표
                  // 때문에 CSS 파싱이 깨져 아무것도 안 보였다. 쌍따옴표로 감싸서 해결.
                  style={{ backgroundImage: `url("${FLAG_ASSET_URLS[flag]}")` }}
                />
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
