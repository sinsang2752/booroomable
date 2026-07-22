import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS } from '../game/config';

interface SetupScreenProps {
  onStart: (playerNames: string[]) => void;
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(MIN_PLAYERS);
  const [names, setNames] = useState<string[]>(Array(MAX_PLAYERS).fill(''));

  function handleNameChange(index: number, value: string) {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  function handleSubmit() {
    const finalNames = names
      .slice(0, playerCount)
      .map((name, i) => name.trim() || `Player ${i + 1}`);
    onStart(finalNames);
  }

  const playerCountOptions = [];
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n += 1) playerCountOptions.push(n);

  return (
    <div className="setup-screen">
      <h1>부루마블</h1>
      <p>인원 수를 고르고 이름을 입력한 뒤 시작하세요.</p>

      <div className="player-count-picker">
        {playerCountOptions.map((n) => (
          <button
            key={n}
            type="button"
            className={n === playerCount ? 'selected' : ''}
            onClick={() => setPlayerCount(n)}
          >
            {n}명
          </button>
        ))}
      </div>

      <div className="player-name-inputs">
        {Array.from({ length: playerCount }, (_, i) => (
          <input
            key={i}
            type="text"
            value={names[i]}
            placeholder={`Player ${i + 1}`}
            maxLength={12}
            onChange={(e) => handleNameChange(i, e.target.value)}
          />
        ))}
      </div>

      <button type="button" className="start-button" onClick={handleSubmit}>
        게임 시작
      </button>
    </div>
  );
}
