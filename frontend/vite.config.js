import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During local dev the React app runs on Vite's port (5173) and proxies
// API / upload / socket traffic to the backend (default http://localhost:5000).
// In production the frontend is a static build served by the backend or a
// static host; set VITE_SOCKET_URL to the backend's public URL.
const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/uploads': { target: BACKEND_URL, changeOrigin: true },
      '/socket.io': { target: BACKEND_URL, ws: true, changeOrigin: true },
    },
  },
})
