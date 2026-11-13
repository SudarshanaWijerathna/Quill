import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { ThemedToaster } from '@/components/ThemedToaster'
import { initTheme } from '@/lib/theme'
import App from './App.tsx'
import './index.css'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <ThemedToaster />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
