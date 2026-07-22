interface ResultScreenProps {
  winnerName: string | null;
  onRestart: () => void;
}

export function ResultScreen({ winnerName, onRestart }: ResultScreenProps) {
  return (
    <div className="result-screen">
      <h1>{winnerName ? `${winnerName}님 승리!` : '게임 종료'}</h1>
      <button type="button" onClick={onRestart}>
        다시하기
      </button>
    </div>
  );
}
