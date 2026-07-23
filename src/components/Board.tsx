import { BOARD } from '../game/board';
import { getTilePosition, TILE_WIDTH_PCT } from '../game/boardLayout';
import { useAnimatedPositions } from '../hooks/useAnimatedPositions';
import type { Player } from '../game/types';
import { PlayerToken } from './PlayerToken';
import { Tile } from './Tile';

interface BoardProps {
  tileOwners: (string | null)[];
  tileLevels: number[];
  players: Player[];
  /** 이번 턴 notice — 말이 걷는 애니메이션 방향(전진/후진/텔레포트) 판단에 쓰인다
   * (useAnimatedPositions 참고). */
  notice?: string | null;
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
  notice = null,
  bubbles,
  selectableTiles,
  onSelectTile,
  children,
}: BoardProps) {
  const animatedPositions = useAnimatedPositions(players, notice);

  return (
    <div className="board">
      {BOARD.map((tile) => {
        const pos = getTilePosition(tile.idx);
        const ownerId = tileOwners[tile.idx];
        const owner = ownerId ? players.find((p) => p.id === ownerId) : undefined;
        const tokensHere = players.filter((p) => (animatedPositions[p.id] ?? p.position) === tile.idx);
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
