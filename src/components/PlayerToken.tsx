import type { Player } from '../game/types';

interface PlayerTokenProps {
  player: Player;
  /** 같은 칸에 여러 말이 있을 때 겹치지 않도록 하는 순번/전체 개수 */
  stackIndex: number;
  stackCount: number;
  /** 채팅 시 3~4초간 떴다 사라지는 말풍선 텍스트 */
  bubbleText?: string;
}

export function PlayerToken({ player, stackIndex, stackCount, bubbleText }: PlayerTokenProps) {
  const spread = 22;
  const offset = (stackIndex - (stackCount - 1) / 2) * spread;

  return (
    <div
      className={`player-token${player.isBankrupt ? ' player-token--bankrupt' : ''}`}
      style={{
        borderColor: `var(--color-${player.color})`,
        transform: `translate(${offset}px, ${offset}px)`,
      }}
      title={player.name}
    >
      <span className="player-token-initial">{player.name.slice(0, 1)}</span>
      <span className="player-token-balance">{player.balance}</span>
      {player.isBankrupt && <span className="player-token-badge">탈락</span>}
      {bubbleText && <span className="player-token-bubble">{bubbleText}</span>}
    </div>
  );
}
