import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import './index.css'
import { reloadOnce } from './lib/reload'
import { DataProvider, SessionProvider, ToastProvider } from './store/Providers'

// Installed-app support (see public/sw.js). Production only, so dev reloads never hit a stale cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'))
}

// A page file from the previous deploy failed to preload: reload into the current one.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnce()) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <SessionProvider>
        <DataProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </DataProvider>
      </SessionProvider>
    </ToastProvider>
  </StrictMode>,
)
