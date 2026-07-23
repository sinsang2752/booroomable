import { BOARD } from '../game/board';
import { getTilePosition, TILE_WIDTH_PCT } from '../game/boardLayout';
import type { Player } from '../game/types';
import { PlayerToken } from './PlayerToken';
import { Tile } from './Tile';

interface BoardProps {
  tileOwners: (string | null)[];
  tileLevels: number[];
  players: Player[];
  /** 엔진 player.id -> 현재 떠 있는 말풍선 텍스트 */
  bubbles?: Record<string, string>;
  /** 출발점 보너스 등에서 "지금 클릭해서 고를 수 있는 칸" 목록 (idx -> 안내문구) */
  selectableTiles?: Map<number, string>;
  onSelectTile?: (idx: number) => void;
  children?: React.ReactNode;
}

export function Board({
  tileOwners,
  tileLevels,
  players,
  bubbles,
  selectableTiles,
  onSelectTile,
  children,
}: BoardProps) {
  return (
    <div className="board">
      {BOARD.map((tile) => {
        const pos = getTilePosition(tile.idx);
        const ownerId = tileOwners[tile.idx];
        const owner = ownerId ? players.find((p) => p.id === ownerId) : undefined;
        const tokensHere = players.filter((p) => p.position === tile.idx);
        const selectHint = selectableTiles?.get(tile.idx);

        return (
          <div
            key={tile.idx}
            className="board-cell"
            style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%`, width: `${TILE_WIDTH_PCT}%` }}
          >
            <Tile
              tile={tile}
              ownerColor={owner?.color ?? null}
              level={tileLevels[tile.idx]}
              selectable={selectHint !== undefined}
              selectHint={selectHint}
              onSelect={() => onSelectTile?.(tile.idx)}
            />
            <div className="board-cell-tokens">
              {tokensHere.map((player, i) => (
                <PlayerToken
                  key={player.id}
                  player={player}
                  stackIndex={i}
                  stackCount={tokensHere.length}
                  bubbleText={bubbles?.[player.id]}
                />
              ))}
            </div>
          </div>
        );
      })}

      <div className="board-center">{children}</div>
    </div>
  );
}
