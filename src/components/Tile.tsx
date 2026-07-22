import type { PlayerColor, Tile as TileData } from '../game/types';

interface TileProps {
  tile: TileData;
  ownerColor: PlayerColor | null;
}

export function Tile({ tile, ownerColor }: TileProps) {
  const label = tile.type === 'start' ? '출발' : tile.type === 'jail' ? '무인도' : tile.name;

  return (
    <div
      className={`tile tile--${tile.type}`}
      style={ownerColor ? { borderColor: `var(--color-${ownerColor})` } : undefined}
    >
      <span className="tile-label">{label}</span>
      {tile.price !== null && <span className="tile-price">{tile.price}</span>}
    </div>
  );
}
