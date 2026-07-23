import { createClient } from '@supabase/supabase-js';
import { updateClockOffsetFromResponse } from './serverClock';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    '.env.local에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정하세요 (.env.example 참고).',
  );
}

// 모든 요청의 응답을 지나가면서 서버 시계 오차(serverClock.ts)를 갱신한다.
async function fetchAndSyncClock(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  updateClockOffsetFromResponse(response);
  return response;
}

export const supabase = createClient(url, anonKey, {
  global: { fetch: fetchAndSyncClock },
});
