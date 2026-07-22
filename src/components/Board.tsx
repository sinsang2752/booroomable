import { BOARD } from '../game/board';
import { getTilePosition } from '../game/boardLayout';
import type { Player } from '../game/types';
import { PlayerToken } from './PlayerToken';
import { Tile } from './Tile';

interface BoardProps {
  tileOwners: (string | null)[];
  players: Player[];
  children?: React.ReactNode;
}

export function Board({ tileOwners, players, children }: BoardProps) {
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
            <Tile tile={tile} ownerColor={owner?.color ?? null} />
            <div className="board-cell-tokens">
              {tokensHere.map((player, i) => (
                <PlayerToken
                  key={player.id}
                  player={player}
                  stackIndex={i}
                  stackCount={tokensHere.length}
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
