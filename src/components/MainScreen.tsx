import { useState } from 'react';

interface MainScreenProps {
  nickname: string;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (code: string) => Promise<void>;
}

export function MainScreen({ nickname, onCreateRoom, onJoinRoom }: MainScreenProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      await onCreateRoom();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onJoinRoom(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="main-screen">
      <h1>부루마블</h1>
      <p>{nickname}님, 반갑습니다.</p>

      <button type="button" className="start-button" onClick={handleCreate} disabled={busy}>
        방 만들기
      </button>

      <div className="join-row">
        <input
          type="text"
          value={code}
          placeholder="방 코드"
          maxLength={5}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="button" onClick={handleJoin} disabled={busy || !code.trim()}>
          참가
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
