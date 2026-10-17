import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    proxy: {
      // Backend is local-only per ADR-15 (127.0.0.1:3000, bearer token, no CORS).
      // This proxy forwards /api/* and injects the token server-side so it never
      // reaches the browser. Set BOUNTY_BOX_API_TOKEN in the shell running `vite`.
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const token = process.env.BOUNTY_BOX_API_TOKEN
            if (token) proxyReq.setHeader('Authorization', `Bearer ${token}`)
          })
        },
      },
    },
  },
})
