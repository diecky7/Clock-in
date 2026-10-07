import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Quietly fix wrong ZIPs saved before they were checked (needs a connection the first time).
setTimeout(() => {
  void import('./data/repo').then((repo) => repo.repairZips()).catch(() => undefined)
}, 3000)
