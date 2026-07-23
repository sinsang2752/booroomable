import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Electron 프로덕션 빌드는 file://로 dist/index.html을 열어서, 절대경로(/assets/...)로
  // 나오면 애셋을 못 찾고 흰 화면만 뜬다. 상대경로로 고정.
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
})
