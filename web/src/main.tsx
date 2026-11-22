import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import './index.css'
import './glow.css'
import Landing from './landing/Landing'
import Waitlist from './landing/Waitlist'
import Saas from './landing/Saas'
import AppShell from './app/AppShell'

function ResetScrollOnRouteChange() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ResetScrollOnRouteChange />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/saas" element={<Saas />} />
        <Route path="/demo" element={<AppShell defaultMode="live" />} />
        <Route path="/app/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
