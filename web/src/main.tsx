import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Landing from './landing/Landing'
import Login from './landing/Login'
import Saas from './landing/Saas'
import RecordedDemo from './app/demo/RecordedDemo'
import AppShell from './app/AppShell'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/saas" element={<Saas />} />
        <Route path="/demo" element={<RecordedDemo />} />
        <Route path="/app/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
