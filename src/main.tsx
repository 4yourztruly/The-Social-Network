import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { forceFreshServiceWorkerOnce } from './forceFreshServiceWorker'

void forceFreshServiceWorkerOnce()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
