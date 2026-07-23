import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { Board } from './components/Board';
import { DiceStage } from './components/DiceStage';
import { LobbyScreen } from './components/LobbyScreen';
import { MainScreen } from './components/MainScreen';
import { NicknameScreen } from './components/NicknameScreen';
import { ResultScreen } from './components/ResultScreen';
import { TurnPanel } from './components/TurnPanel';
import { TurnTimer } from './components/TurnTimer';
import { BOARD } from './game/board';
import { getStartBonusEligibleTiles, getUpgradeCost } from './game/buildings';
import { BUILDING_LEVEL_NAMES } from './game/config';
import { useLobby } from './hooks/useLobby';
import { useRoomChat } from './hooks/useRoomChat';
import { useSyncedGame } from './hooks/useSyncedGame';
import { getClientId, getStoredNickname, setStoredNickname } from './lib/identity';
import { createRoom, findActiveLobbyForClient, joinRoomByCode } from './lobby/api';

type Screen = 'loading' | 'nickname' | 'main' | 'lobby' | 'game';

const BUBBLE_DURATION_MS = 3500;

interface GameScreenProps {
  roomId: string;
  onRestart: () => void;
}

function GameScreen({ roomId, onRestart }: GameScreenProps) {
  const clientId = useMemo(() => getClientId(), []);
  const {
    state,
    dbPlayers,
    loading,
    error,
    isMyTurn,
    isEliminated,
    isSubmitting,
    turnDeadlineMs,
    turnTimeSec,
    rollDice,
    decidePurchase,
    decideBuild,
    decideInitialBuild,
    decideStartBonusBuild,
    decideSpaceTravel,
    forfeit,
  } = useSyncedGame(roomId);
  const myPlayer = dbPlayers.find((p) => p.client_id === clientId);
  const myNickname = myPlayer?.nickname ?? '';
  const { messages, sendMessage } = useRoomChat(roomId, clientId, myNickname);

  const enginePlayerIdByClientId = useMemo(() => {
    const map: Record<string, string> = {};
    dbPlayers.forEach((p) => {
      map[p.client_id] = p.id;
    });
    return map;
  }, [dbPlayers]);

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

  const selectableTiles = useMemo(() => {
    if (!state || !myPlayer || !isMyTurn) return undefined;

    if (state.phase === 'awaiting-start-bonus-build') {
      const map = new Map<number, string>();
      for (const idx of getStartBonusEligibleTiles(state, myPlayer.id)) {
        const level = state.tileLevels[idx];
        const cost = getUpgradeCost(idx, level);
        const nextLevelName = BUILDING_LEVEL_NAMES[level + 1];
        map.set(idx, `${BOARD[idx].name} → ${nextLevelName}(으)로 업그레이드 (${cost})`);
      }
      return map;
    }

    if (state.phase === 'awaiting-space-travel-destination') {
      const myPosition = state.players.find((p) => p.id === myPlayer.id)?.position;
      const map = new Map<number, string>();
      for (const tile of BOARD) {
        if (tile.type === 'space_travel' || tile.idx === myPosition) continue;
        map.set(tile.idx, `${tile.name}(으)로 우주여행`);
      }
      return map;
    }

    return undefined;
  }, [state, myPlayer, isMyTurn]);

  function handleSelectTile(idx: number) {
    if (state?.phase === 'awaiting-space-travel-destination') {
      decideSpaceTravel(idx);
    } else {
      decideStartBonusBuild(idx);
    }
  }

  if (error) {
    return (
      <div className="game-screen">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (loading || !state) {
    return <div className="loading-screen">불러오는 중...</div>;
  }

  const winner = state.players.find((p) => p.id === state.winnerId) ?? null;
  const currentPlayer = state.players[state.currentPlayerIndex];

  return (
    <div className="game-screen">
      <div className="game-layout">
        <div className="play-area">
          {state.phase !== 'game-over' && (
            <TurnTimer
              turnNumber={state.turnNumber}
              turnDeadlineMs={turnDeadlineMs}
              turnTimeSec={turnTimeSec}
            />
          )}
          <Board
            tileOwners={state.tileOwners}
            tileLevels={state.tileLevels}
            players={state.players}
            bubbles={bubbles}
            selectableTiles={selectableTiles}
            onSelectTile={handleSelectTile}
          >
            {state.phase === 'game-over' ? (
              <ResultScreen winnerName={winner?.name ?? null} onRestart={onRestart} />
            ) : (
              <DiceStage
                lastRoll={state.lastRoll}
                isDoubleRoll={state.isDoubleRoll}
                phase={state.phase}
                playerName={currentPlayer.name}
                playerColor={currentPlayer.color}
              />
            )}
          </Board>
        </div>
        {state.phase !== 'game-over' && (
          <div className="right-column">
            <TurnPanel
              state={state}
              isMyTurn={isMyTurn}
              isEliminated={isEliminated}
              isSubmitting={isSubmitting}
              onRoll={rollDice}
              onDecide={decidePurchase}
              onDecideBuild={decideBuild}
              onDecideInitialBuild={decideInitialBuild}
              onSkipStartBonusBuild={() => decideStartBonusBuild(null)}
              onSkipSpaceTravel={() => decideSpaceTravel(null)}
              onForfeit={forfeit}
            />
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
          </div>
        )}
      </div>
    </div>
  );
}

interface LobbyContainerProps {
  roomId: string;
  onGameStart: () => void;
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

  // 닉네임/메인/로비는 작은 창, 게임 화면은 넓은 창 — Electron에서만 존재하는 API라
  // 일반 브라우저 탭에서는 아무 일도 안 일어난다(electron/preload.cjs 참고).
  useEffect(() => {
    window.electronAPI?.resizeWindow(screen === 'game' ? 'game' : 'compact');
  }, [screen]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const active = await findActiveLobbyForClient();
        if (cancelled) return;
        if (active) {
          setNickname(active.player.nickname);
          setRoomId(active.room.id);
          setScreen(active.room.status === 'playing' ? 'game' : 'lobby');
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

  function handleGameStart() {
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
    return <GameScreen roomId={roomId} onRestart={handleRestart} />;
  }

  return null;
}

export default App;
