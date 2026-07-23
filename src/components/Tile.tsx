import { BUILDING_LEVEL_NAMES } from '../game/config';
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

export function Tile({ tile, ownerColor, level = 0, selectable = false, selectHint, onSelect }: TileProps) {
  const label = tile.type === 'start' ? '출발' : tile.type === 'jail' ? '무인도' : tile.name;

  return (
    <div
      className={`tile tile--${tile.type}${selectable ? ' tile--selectable' : ''}`}
      style={ownerColor ? { borderColor: `var(--color-${ownerColor})` } : undefined}
      title={selectable ? selectHint : undefined}
      onClick={selectable ? onSelect : undefined}
    >
      <span className="tile-label">{label}</span>
      {tile.price !== null && <span className="tile-price">{tile.price}</span>}
      {level > 0 && <span className="tile-level">🏠 {BUILDING_LEVEL_NAMES[level]}</span>}
    </div>
  );
}
