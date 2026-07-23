/** supabase.functions.invoke()가 실패했을 때, 우리 Edge Function이 응답 본문에 담아준
 * { error: string } 메시지를 꺼낸다. 못 꺼내면 기본 에러 메시지로 폴백. */
export async function extractFunctionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    try {
      const context = (error as { context: Response }).context;
      const body = await context.json();
      if (body && typeof body.error === 'string') return body.error;
    } catch {
      // 파싱 실패 시 아래 기본 메시지로 폴백
    }
  }
  return error instanceof Error ? error.message : String(error);
}
