import os from 'node:os'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests. Starts an isolated backend (port 8001, fresh temporary SQLite DB with demo
 * users) and Vite dev server (port 5174), so it never touches the developer's running servers or
 * local database. Uses the locally installed Microsoft Edge (no browser download needed);
 * set PW_CHANNEL=chrome (or "" for bundled Chromium after `npx playwright install`) to change.
 */
const API_PORT = 8001
const WEB_PORT = 5174
const dbFile = path.join(os.tmpdir(), `quill-e2e-${process.pid}.db`).replaceAll('\\', '/')
const python = process.platform === 'win32' ? '.venv\\Scripts\\python' : '.venv/bin/python'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: process.env.PW_CHANNEL ?? 'msedge',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `${python} -m uvicorn app.main:app --port ${API_PORT}`,
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        DATABASE_URL: `sqlite:///${dbFile}`,
        SEED_DEMO_DATA: 'true',
        JWT_SECRET: 'e2e-only-secret-key-not-for-production-use',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_DEV_API_PROXY: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
