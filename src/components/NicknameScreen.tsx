import { useState } from 'react';
import logo from '../assets/logo.png';

interface NicknameScreenProps {
  onSubmit: (nickname: string) => void;
}

export function NicknameScreen({ onSubmit }: NicknameScreenProps) {
  const [nickname, setNickname] = useState('');

  function handleSubmit() {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <div className="nickname-screen">
      <img src={logo} alt="부루마블" className="brand-logo" />
      <p>사용하실 닉네임을 입력해주세요.</p>
      <input
        type="text"
        value={nickname}
        placeholder="닉네임"
        maxLength={12}
        onChange={(e) => setNickname(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
      />
      <button type="button" className="start-button" onClick={handleSubmit} disabled={!nickname.trim()}>
        다음
      </button>
    </div>
  );
}
