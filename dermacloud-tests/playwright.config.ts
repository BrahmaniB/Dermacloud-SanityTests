import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file — makes process.env.TEST_EMAIL etc available everywhere
// WHY: credentials should never be hardcoded in test files
// .env file stays on your machine only, never pushed to GitHub
dotenv.config();

export default defineConfig({

  // Login once before the entire test suite runs — saves token to playwright/.auth/user.json
  // Form tests load that file instead of doing a UI login, bypassing the rate limiter
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  // Playwright starts the Next.js app before tests run.
  // MONGODB_URI is injected here — Next.js respects env vars set before startup
  // over any .env file, so this always points at the local test DB.
  // Stop any running dev server before running tests — port 3000 must be free.
  webServer: {
    command: 'npm run dev',
    cwd: path.join(__dirname, '..', 'DermaCloud'),
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      MONGODB_URI: 'mongodb://localhost:27017/dermacloud-test',
    },
  },

  // Where to look for test files
  testDir: './tests',

  // Run all tests in parallel (at the same time)
  fullyParallel: true,

  // Fail the build if someone accidentally left test.only() in the code (CI only)
  forbidOnly: !!process.env.CI,

  // How many times to retry a failed test
  // On CI: 2 retries | On local machine: 0 retries
  retries: process.env.CI ? 2 : 0,

  // How many tests to run at the same time
  // On CI: 1 | On local: 1 also — because dashboard tests login to MongoDB
  // and running them in parallel causes race conditions on a local server
  workers: 1,

  // Type of report to generate after test run
  // Run "npx playwright show-report" to open it
  reporter: 'html',

  // Global settings that apply to ALL tests
  use: {
    // Base URL — DermaCloud running locally
    // Now we can write page.goto('/login') instead of http://localhost:3000/login everywhere
    baseURL: 'http://localhost:3000',

    // Record a trace (video + screenshots + network) when a test fails and retries
    trace: 'on-first-retry',

    // Take a screenshot when a test fails
    screenshot: 'only-on-failure',

    // Show the browser window — set to false for headless (faster)
    headless: true,

    // How long to wait for an action (click, fill) before failing — 30 seconds
    actionTimeout: 30000,

    // How long to wait for page navigation before failing — 30 seconds
    navigationTimeout: 30000,
  },

  // ─── TEST GROUPS ──────────────────────────────────────────────────────────
  // Tests are split into 3 projects to avoid hitting the login API rate limiter.
  //
  // WHY groups? Running all 44 tests back-to-back floods the same login endpoints
  // with rapid requests. The rate limiter starts rejecting logins mid-suite, causing
  // cascading timeouts. Each project uses a distinct credential set or no login at all.
  //
  // Run commands:
  //   npx playwright test --project=smoke       # no-login + storageState tests
  //   npx playwright test --project=clinic      # clinic portal auth-heavy tests
  //   npx playwright test --project=frontdesk   # frontdesk portal tests
  //   npx playwright test                       # all groups (wait a few min between runs)
  projects: [

    // ── Group 1: smoke ────────────────────────────────────────────────────
    // Zero or one real login (globalSetup runs once for storageState).
    // Safe to run any time, never triggers the clinic rate limiter.
    {
      name: 'smoke',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        '**/example.spec.ts',
        '**/google.spec.ts',
        '**/signup.spec.ts',
        '**/forms.spec.ts',
        '**/cosmetology-forms.spec.ts',
      ],
    },

    // ── Group 2: clinic ───────────────────────────────────────────────────
    // Uses TEST_EMAIL / TEST_PASSWORD (clinic portal login endpoint).
    // Has ~14 real logins across login, logout, dashboard, frontdesk-add-staff.
    // Run separately — allow a few minutes gap after a previous clinic run.
    {
      name: 'clinic',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        '**/login.spec.ts',
        '**/logout.spec.ts',
        '**/dashboard.spec.ts',
        '**/frontdesk.spec.ts',
      ],
    },

    // ── Group 3: frontdesk ────────────────────────────────────────────────
    // Uses FRONTDESK_EMAIL / FRONTDESK_PASSWORD — a completely separate login
    // endpoint from the clinic group. Safe to run in parallel with clinic or smoke.
    {
      name: 'frontdesk',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        '**/frontdesk-portal-login.spec.ts',
        '**/frontdesk-edit.spec.ts',
        '**/frontdesk-book-appointment.spec.ts',
      ],
    },

    // ── Group 4: e2e ──────────────────────────────────────────────────────
    // Full cross-portal end-to-end workflows that span both the frontdesk
    // and clinic (doctor) portals in a single test run.
    // Uses both credential pairs. Run with a few minutes gap after clinic or
    // frontdesk groups to avoid login rate-limiting.
    //
    // Run commands:
    //   npx playwright test --project=e2e --headed   # headed + video (recommended)
    //   npx playwright test --project=e2e            # headless + video (faster)
    //   npx playwright show-report                   # open HTML report with embedded video
    {
      name: 'e2e',
      use: {
        ...devices['Desktop Chrome'],
        // 400ms pause between every action so each step is clearly visible
        launchOptions: { slowMo: 400 },
      },
      testMatch: [
        '**/e2e-*.spec.ts',
      ],
    },

  ],

});
