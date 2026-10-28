import { defineConfig, devices } from '@playwright/test';

// End-to-end tests (§13 Phase 7) drive a production build of the app in a real browser. The
// app talks to a fake Supabase (e2e/fakeSupabase.ts), so no account or live data is involved.
const PORT = 4174;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The service worker would cache the app between tests; the tests check the app itself.
    serviceWorkers: 'block',
    timezoneId: 'Africa/Lagos',
    locale: 'en-GB',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Always a fresh build, so a leftover preview server can't serve old code.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: 'https://e2e.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key-not-a-real-key',
    },
  },
});
