import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WindowChrome } from './components/WindowChrome.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WindowChrome />
    <App />
  </StrictMode>,
)
