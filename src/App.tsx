import { useEffect, useState } from 'react';
import './App.css';
import { Board } from './components/Board';
import { LobbyScreen } from './components/LobbyScreen';
import { MainScreen } from './components/MainScreen';
import { NicknameScreen } from './components/NicknameScreen';
import { ResultScreen } from './components/ResultScreen';
import { TurnPanel } from './components/TurnPanel';
import { useGame } from './hooks/useGame';
import { useLobby } from './hooks/useLobby';
import { getStoredNickname, setStoredNickname } from './lib/identity';
import { createRoom, findActiveLobbyForClient, joinRoomByCode } from './lobby/api';

type Screen = 'loading' | 'nickname' | 'main' | 'lobby' | 'game';

interface GameScreenProps {
  playerNames: string[];
  onRestart: () => void;
}

function GameScreen({ playerNames, onRestart }: GameScreenProps) {
  const { state, rollDice, decidePurchase } = useGame(playerNames);
  const winner = state.players.find((p) => p.id === state.winnerId) ?? null;

  return (
    <div className="game-screen">
      <Board tileOwners={state.tileOwners} players={state.players}>
        {state.phase === 'game-over' ? (
          <ResultScreen winnerName={winner?.name ?? null} onRestart={onRestart} />
        ) : (
          <TurnPanel state={state} onRoll={rollDice} onDecide={decidePurchase} />
        )}
      </Board>
    </div>
  );
}

interface LobbyContainerProps {
  roomId: string;
  onGameStart: (names: string[]) => void;
}

function LobbyContainer({ roomId, onGameStart }: LobbyContainerProps) {
  const { loading, room, players, myPlayer, isHost, error, toggleReady, setTurnTime, startGame } =
    useLobby(roomId, onGameStart);

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
    />
  );
}

function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerNames, setPlayerNames] = useState<string[]>([]);

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

  function handleGameStart(names: string[]) {
    setPlayerNames(names);
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
    return <LobbyContainer roomId={roomId} onGameStart={handleGameStart} />;
  }

  return <GameScreen playerNames={playerNames} onRestart={handleRestart} />;
}

export default App;
