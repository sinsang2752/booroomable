const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 I/O/0/1 제외
const CODE_LENGTH = 5;

/** 사람이 말로 불러주거나 타이핑하기 쉬운 5자리 방 코드 */
export function generateRoomCode(): string {
  const randomValues = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(randomValues);

  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_CHARS[randomValues[i] % CODE_CHARS.length];
  }
  return code;
}
