/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite proxies API, upload, and Socket.IO traffic in development. Keeping
// browser requests same-origin makes the app work in local networks and Arena
// preview URLs without hard-coded localhost calls.
const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:5000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/uploads': { target: BACKEND_URL, changeOrigin: true },
      '/upload': { target: BACKEND_URL, changeOrigin: true },
      '/socket.io': { target: BACKEND_URL, ws: true, changeOrigin: true },
    },
  },
})
