const CLIENT_ID_STORAGE_KEY = 'booroomable:client_id';
const NICKNAME_STORAGE_KEY = 'booroomable:nickname';

/**
 * 로그인 없이 이 브라우저를 식별하는 고유 id. 최초 실행 시 생성해 localStorage에 저장하고,
 * 이후로는 새로고침/재실행해도 같은 값을 반환한다 (CLAUDE.md의 "신원 관리" 참고).
 */
export function getClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) return existing;

  const clientId = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  return clientId;
}

/** 표시용 닉네임. 한 번 입력하면 저장해두고 다음에 다시 묻지 않는다. */
export function getStoredNickname(): string | null {
  return localStorage.getItem(NICKNAME_STORAGE_KEY);
}

export function setStoredNickname(nickname: string): void {
  localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
}
