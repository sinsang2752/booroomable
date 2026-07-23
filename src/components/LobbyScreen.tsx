import { useState } from 'react';
import type { ChatMessage } from '../chat/types';
import { ChatPanel } from './ChatPanel';
import { MIN_PLAYERS } from '../game/config';
import type { LobbyPlayer, RoomRow } from '../lobby/types';

interface LobbyScreenProps {
  room: RoomRow;
  players: LobbyPlayer[];
  myPlayer: LobbyPlayer | null;
  isHost: boolean;
  onToggleReady: () => void;
  onSetTurnTime: (sec: number) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  chatMessages: ChatMessage[];
  onSendChat: (body: string) => void;
}

export function LobbyScreen({
  room,
  players,
  myPlayer,
  isHost,
  onToggleReady,
  onSetTurnTime,
  onStartGame,
  onLeaveRoom,
  chatMessages,
  onSendChat,
}: LobbyScreenProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // 방장은 준비 여부와 상관없이 시작 버튼을 가지므로, "모두 준비완료" 조건에서는 제외한다.
  const nonHostPlayers = players.filter((p) => p.client_id !== room.host_client_id);
  const canStart = players.length >= MIN_PLAYERS && nonHostPlayers.every((p) => p.is_ready);

  return (
    <div className="lobby-screen">
      <h1>로비</h1>

      <div className="room-code-row">
        <span className="room-code">{room.code}</span>
        <button type="button" onClick={handleCopy}>
          {copied ? '복사됨' : '코드 복사'}
        </button>
      </div>

      <button type="button" className="leave-button" onClick={onLeaveRoom}>
        로비 나가기
      </button>

      {isHost && (
        <label className="turn-time-row">
          턴 제한시간
          <select
            value={room.turn_time_sec}
            onChange={(e) => onSetTurnTime(Number(e.target.value))}
          >
            {[20, 30, 40, 50, 60].map((sec) => (
              <option key={sec} value={sec}>
                {sec}초
              </option>
            ))}
          </select>
        </label>
      )}

      <ul className="lobby-players">
        {players.map((p) => (
          <li key={p.id} style={{ borderColor: `var(--color-${p.color})` }}>
            <span>{p.nickname}</span>
            {p.client_id === room.host_client_id ? (
              <span className="host-badge">방장</span>
            ) : (
              <span className={p.is_ready ? 'ready-badge' : 'not-ready-badge'}>
                {p.is_ready ? '준비완료' : '대기중'}
              </span>
            )}
          </li>
        ))}
      </ul>

      {myPlayer && !isHost && (
        <button type="button" onClick={onToggleReady}>
          {myPlayer.is_ready ? '준비 취소' : '준비 완료'}
        </button>
      )}

      {isHost && (
        <button type="button" className="start-button" onClick={onStartGame} disabled={!canStart}>
          게임 시작
        </button>
      )}

      {isHost && !canStart && (
        <p className="lobby-hint">
          최소 {MIN_PLAYERS}명, 방장을 제외한 모든 참가자가 준비 완료해야 시작할 수 있습니다.
        </p>
      )}

      <ChatPanel messages={chatMessages} onSend={onSendChat} />
    </div>
  );
}
