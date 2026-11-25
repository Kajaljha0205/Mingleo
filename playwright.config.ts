import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const MOCK_PORT = 54399;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  reporter: "list",
  // Single mock Supabase user shared across tests.
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Desktop Chrome"] },
  webServer: [
    {
      command: `node e2e/mock-supabase.mjs`,
      port: MOCK_PORT,
      reuseExistingServer: false,
      env: { MOCK_SUPABASE_PORT: String(MOCK_PORT) },
    },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      port: PORT,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${MOCK_PORT}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      },
    },
  ],
});
