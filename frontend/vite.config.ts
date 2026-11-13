import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    server: {
      port: 5173,
      // Dev: proxy API calls to FastAPI so the browser stays same-origin (no CORS needed).
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_PROXY ?? 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
