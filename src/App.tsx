import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { Board } from './components/Board';
import { LobbyScreen } from './components/LobbyScreen';
import { MainScreen } from './components/MainScreen';
import { NicknameScreen } from './components/NicknameScreen';
import { ResultScreen } from './components/ResultScreen';
import { TurnPanel } from './components/TurnPanel';
import { useGame } from './hooks/useGame';
import { useLobby } from './hooks/useLobby';
import { useRoomChat } from './hooks/useRoomChat';
import { getClientId, getStoredNickname, setStoredNickname } from './lib/identity';
import { createRoom, findActiveLobbyForClient, joinRoomByCode } from './lobby/api';
import type { GameRosterEntry } from './lobby/types';

type Screen = 'loading' | 'nickname' | 'main' | 'lobby' | 'game';

const BUBBLE_DURATION_MS = 3500;

interface GameScreenProps {
  roomId: string;
  roster: GameRosterEntry[];
  onRestart: () => void;
}

function GameScreen({ roomId, roster, onRestart }: GameScreenProps) {
  const clientId = useMemo(() => getClientId(), []);
  const playerNames = useMemo(() => roster.map((r) => r.nickname), [roster]);
  const myNickname = roster.find((r) => r.clientId === clientId)?.nickname ?? '';

  const { state, rollDice, decidePurchase } = useGame(playerNames);
  const { messages, sendMessage } = useRoomChat(roomId, clientId, myNickname);

  const enginePlayerIdByClientId = useMemo(() => {
    const map: Record<string, string> = {};
    state.players.forEach((p, i) => {
      const entry = roster[i];
      if (entry) map[entry.clientId] = p.id;
    });
    return map;
  }, [state.players, roster]);

  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const processedCountRef = useRef(0);

  useEffect(() => {
    const newMessages = messages.slice(processedCountRef.current);
    processedCountRef.current = messages.length;

    for (const message of newMessages) {
      const playerId = enginePlayerIdByClientId[message.clientId];
      if (!playerId) continue;

      setBubbles((prev) => ({ ...prev, [playerId]: message.body }));

      if (timersRef.current[playerId]) clearTimeout(timersRef.current[playerId]);
      timersRef.current[playerId] = setTimeout(() => {
        setBubbles((prev) => {
          const next = { ...prev };
          delete next[playerId];
          return next;
        });
      }, BUBBLE_DURATION_MS);
    }
  }, [messages, enginePlayerIdByClientId]);

  useEffect(
    () => () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    },
    [],
  );

  const winner = state.players.find((p) => p.id === state.winnerId) ?? null;

  return (
    <div className="game-screen">
      <Board tileOwners={state.tileOwners} players={state.players} bubbles={bubbles}>
        {state.phase === 'game-over' ? (
          <ResultScreen winnerName={winner?.name ?? null} onRestart={onRestart} />
        ) : (
          <>
            <TurnPanel state={state} onRoll={rollDice} onDecide={decidePurchase} />
            <input
              type="text"
              className="game-chat-input"
              placeholder="메시지 (20자)"
              maxLength={20}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const target = e.currentTarget;
                sendMessage(target.value);
                target.value = '';
              }}
            />
          </>
        )}
      </Board>
    </div>
  );
}

interface LobbyContainerProps {
  roomId: string;
  onGameStart: (roster: GameRosterEntry[]) => void;
  onLeave: () => void;
}

function LobbyContainer({ roomId, onGameStart, onLeave }: LobbyContainerProps) {
  const clientId = useMemo(() => getClientId(), []);
  const {
    loading,
    room,
    players,
    myPlayer,
    isHost,
    error,
    toggleReady,
    setTurnTime,
    startGame,
    leaveRoom,
  } = useLobby(roomId, onGameStart);
  const { messages, sendMessage } = useRoomChat(roomId, clientId, myPlayer?.nickname ?? '');

  async function handleLeave() {
    await leaveRoom();
    onLeave();
  }

  if (error) {
    return (
      <div className="lobby-screen">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (loading || !room) {
    return <div className="loading-screen">불러오는 중...</div>;
  }

  return (
    <LobbyScreen
      room={room}
      players={players}
      myPlayer={myPlayer}
      isHost={isHost}
      onToggleReady={toggleReady}
      onSetTurnTime={setTurnTime}
      onStartGame={startGame}
      onLeaveRoom={handleLeave}
      chatMessages={messages}
      onSendChat={sendMessage}
    />
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roster, setRoster] = useState<GameRosterEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const active = await findActiveLobbyForClient();
        if (cancelled) return;
        if (active) {
          setNickname(active.player.nickname);
          setRoomId(active.room.id);
          setScreen('lobby');
          return;
        }
      } catch {
        // 재접속 조회 실패는 무시하고 처음부터 진행
      }

      if (cancelled) return;
      const storedNickname = getStoredNickname();
      if (storedNickname) {
        setNickname(storedNickname);
        setScreen('main');
      } else {
        setScreen('nickname');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleNicknameSubmit(name: string) {
    setStoredNickname(name);
    setNickname(name);
    setScreen('main');
  }

  async function handleCreateRoom() {
    const { room } = await createRoom(nickname);
    setRoomId(room.id);
    setScreen('lobby');
  }

  async function handleJoinRoom(code: string) {
    const { room } = await joinRoomByCode(code, nickname);
    setRoomId(room.id);
    setScreen('lobby');
  }

  function handleGameStart(newRoster: GameRosterEntry[]) {
    setRoster(newRoster);
    setScreen('game');
  }

  function handleRestart() {
    setRoomId(null);
    setScreen('main');
  }

  if (screen === 'loading') {
    return <div className="loading-screen">불러오는 중...</div>;
  }

  if (screen === 'nickname') {
    return <NicknameScreen onSubmit={handleNicknameSubmit} />;
  }

  if (screen === 'main') {
    return (
      <MainScreen nickname={nickname} onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
    );
  }

  if (screen === 'lobby' && roomId) {
    return <LobbyContainer roomId={roomId} onGameStart={handleGameStart} onLeave={handleRestart} />;
  }

  if (roomId) {
    return <GameScreen roomId={roomId} roster={roster} onRestart={handleRestart} />;
  }

  return null;
}

export default App;
