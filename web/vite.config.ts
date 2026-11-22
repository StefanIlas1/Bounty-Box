import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function backendToken(): string | undefined {
  const fromShell = process.env.BOUNTYBOX_API_TOKEN || process.env.BOUNTY_BOX_API_TOKEN
  if (fromShell) return fromShell
  for (const f of ['../.env.backend.local', '../.env']) {
    try {
      const m = fs.readFileSync(path.resolve(__dirname, f), 'utf8').match(/^BOUNTYBOX_API_TOKEN=(.+)$/m)
      if (m) return m[1].trim().replace(/^["']|["']$/g, '')
    } catch {}
  }
  return undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    proxy: {
      '/api': {
        target: process.env.BOUNTYBOX_API_URL || 'http://127.0.0.1:3000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const token = backendToken()
            if (token) proxyReq.setHeader('Authorization', `Bearer ${token}`)
          })
        },
      },
    },
  },
})
