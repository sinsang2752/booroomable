import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    '.env.local에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정하세요 (.env.example 참고).',
  );
}

export const supabase = createClient(url, anonKey);
