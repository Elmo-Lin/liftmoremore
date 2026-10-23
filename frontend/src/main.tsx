import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { DataProvider, SessionProvider, ToastProvider } from './store/Providers'

// Installed-app support (see public/sw.js). Production only, so dev reloads never hit a stale cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <SessionProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </SessionProvider>
    </ToastProvider>
  </StrictMode>,
)
