import { useState } from 'react';
import type { ChatMessage } from '../chat/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (body: string) => void;
}

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft('');
  }

  return (
    <div className="chat-panel">
      <ul className="chat-messages">
        {messages.map((m) => (
          <li key={`${m.at}-${m.clientId}`}>
            <span className="chat-nickname">{m.nickname}</span>
            <span className="chat-body">{m.body}</span>
          </li>
        ))}
      </ul>
      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          value={draft}
          placeholder="메시지 (20자)"
          maxLength={20}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={!draft.trim()}>
          전송
        </button>
      </form>
    </div>
  );
}
