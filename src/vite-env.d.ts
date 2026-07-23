/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** electron/preload.cjs가 노출하는 API. 일반 브라우저 탭에서는 없으므로 항상 optional로 접근할 것. */
interface Window {
  electronAPI?: {
    resizeWindow: (mode: 'compact' | 'game') => void;
  };
}
