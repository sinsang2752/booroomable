import { BOARD } from '../game/board';
import { getTilePosition } from '../game/boardLayout';
import type { Player } from '../game/types';
import { PlayerToken } from './PlayerToken';
import { Tile } from './Tile';

interface BoardProps {
  tileOwners: (string | null)[];
  tileLevels: number[];
  players: Player[];
  /** 엔진 player.id -> 현재 떠 있는 말풍선 텍스트 */
  bubbles?: Record<string, string>;
  children?: React.ReactNode;
}

export function Board({ tileOwners, tileLevels, players, bubbles, children }: BoardProps) {
  return (
    <div className="board">
      {BOARD.map((tile) => {
        const pos = getTilePosition(tile.idx);
        const ownerId = tileOwners[tile.idx];
        const owner = ownerId ? players.find((p) => p.id === ownerId) : undefined;
        const tokensHere = players.filter((p) => p.position === tile.idx);

        return (
          <div
            key={tile.idx}
            className="board-cell"
            style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%` }}
          >
            <Tile tile={tile} ownerColor={owner?.color ?? null} level={tileLevels[tile.idx]} />
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
