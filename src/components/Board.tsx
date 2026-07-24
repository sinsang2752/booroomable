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
  /** 새 주사위 굴림 식별자(lastRoll 기반, App.tsx가 계산). 바뀌면 주사위 애니메이션이 끝날
   * 때까지 말 이동을 미룬다(useAnimatedPositions). */
  rollKey?: string | null;
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
  rollKey = null,
  children,
}: BoardProps) {
  const animatedPositions = useAnimatedPositions(players, notice, rollKey);

  // 각 말이 "지금 화면에 보여줄 칸"(애니메이션 중이면 걸어가는 중간 칸).
  const displayPosOf = (player: Player) => animatedPositions[player.id] ?? player.position;

  return (
    <div className="board">
      {BOARD.map((tile) => {
        const pos = getTilePosition(tile.idx);
        const ownerId = tileOwners[tile.idx];
        const owner = ownerId ? players.find((p) => p.id === ownerId) : undefined;
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
          </div>
        );
      })}

      {/* 말은 board-cell 밖, board 직속에 절대배치 — 칸이 바뀌어도 DOM 부모가 안 바뀌어서
       * CSS transition(App.css .player-token)으로 칸 사이를 부드럽게 슬라이드한다. */}
      {players.map((player) => {
        const displayPos = displayPosOf(player);
        const pos = getTilePosition(displayPos);
        // 같은 칸에 있는 말들끼리 좌우로 나란히 펼치기 위한 순번/개수.
        const sameCell = players.filter((p) => displayPosOf(p) === displayPos);
        const stackIndex = sameCell.findIndex((p) => p.id === player.id);
        return (
          <PlayerToken
            key={player.id}
            player={player}
            xPct={pos.xPct}
            yPct={pos.yPct}
            stackIndex={stackIndex}
            stackCount={sameCell.length}
            bubbleText={bubbles?.[player.id]}
          />
        );
      })}

      <div className="board-center">{children}</div>
    </div>
  );
}
