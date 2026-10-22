import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { DataProvider, SessionProvider, ToastProvider } from './store/Providers'

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
