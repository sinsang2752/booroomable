import { useState } from 'react';
import './App.css';
import { Board } from './components/Board';
import { ResultScreen } from './components/ResultScreen';
import { SetupScreen } from './components/SetupScreen';
import { TurnPanel } from './components/TurnPanel';
import { useGame } from './hooks/useGame';

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

function App() {
  const [screen, setScreen] = useState<'setup' | 'game'>('setup');
  const [playerNames, setPlayerNames] = useState<string[]>([]);

  if (screen === 'setup') {
    return (
      <SetupScreen
        onStart={(names) => {
          setPlayerNames(names);
          setScreen('game');
        }}
      />
    );
  }

  return <GameScreen playerNames={playerNames} onRestart={() => setScreen('setup')} />;
}

export default App;
