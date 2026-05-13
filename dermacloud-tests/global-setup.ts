import { chromium } from '@playwright/test';
import * as fs   from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import dotenv    from 'dotenv';

// Load .env so process.env.TEST_EMAIL / TEST_PASSWORD are available here
// WHY load again? global-setup runs before Playwright processes the config,
// so the dotenv.config() in playwright.config.ts hasn't run yet
dotenv.config();

async function globalSetup() {
  // Seed the local test database with a clean clinic admin + frontdesk staff
  // before any test runs — this ensures every test run starts from a known state
  execSync('npx tsx scripts/seed-test-db.ts', {
    cwd: path.join(__dirname, '..', 'DermaCloud'),
    env: { ...process.env, MONGODB_URI: 'mongodb://localhost:27017/dermacloud-test' },
    stdio: 'inherit',
  });

  // Create the auth directory if it doesn't already exist
  const authDir = path.join(__dirname, 'playwright/.auth');
  fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();

  // ── Step 1: Clinic doctor login — save storageState for form tests ────────
  // Form tests (smoke / clinic groups) load this file instead of doing a real
  // UI login, which would hammer the rate limiter.
  const clinicPage = await browser.newPage();
  await clinicPage.goto('http://localhost:3000/login');
  await clinicPage.getByPlaceholder('doctor@example.com').fill(process.env.TEST_EMAIL!);
  await clinicPage.getByPlaceholder('Enter your password').fill(process.env.TEST_PASSWORD!);
  await clinicPage.getByRole('button', { name: 'Sign In' }).click();
  await clinicPage.waitForURL(/clinic\/dashboard/, { timeout: 30000 });
  // Wait for dashboard API calls to drain before saving state.
  // If we close while requests are in-flight, Next.js aborts them but the
  // Mongoose queries inside keep running — holding pool connections. Those
  // ghost connections cause subsequent test requests to hang forever waiting
  // for a free slot (Mongoose default: no timeout for pool wait queue).
  try { await clinicPage.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}
  await clinicPage.context().storageState({ path: path.join(authDir, 'user.json') });

  // ── Step 2: Frontdesk login warm-up ──────────────────────────────────────
  // Logs in as frontdesk and loads the dashboard. The dashboard fires several
  // authenticated GET requests (appointments, stats, patients count) which:
  //   1. Compiles all tier2 TypeScript route files (lazy compilation in dev)
  //   2. Exercises the full Mongoose query path so the connection pool is hot
  // This prevents the first test POST from being slow due to cold compilation.
  //
  // Frontdesk uses localStorage (not cookies) — storageState not needed here.
  const fdPage = await browser.newPage();
  await fdPage.goto('http://localhost:3000/frontdesk/login');
  await fdPage.getByPlaceholder('frontdesk@clinic.com').fill(process.env.FRONTDESK_EMAIL!);
  await fdPage.getByPlaceholder('Enter your password').fill(process.env.FRONTDESK_PASSWORD!);
  await fdPage.getByRole('button', { name: 'Sign In' }).click();
  await fdPage.waitForURL(/frontdesk\/dashboard/, { timeout: 30000 });
  // Same reason as above — wait for all dashboard API calls to complete and
  // return their Mongoose connections to the pool before closing the browser.
  try { await fdPage.waitForLoadState('networkidle', { timeout: 10000 }); } catch {}

  await browser.close();

  // ── Step 3: Fetch warm-up for routes NOT called by the dashboard ──────────
  // The browser login above compiles routes the dashboard loads (appointments
  // list, patients count, stats). But several routes are only hit mid-test and
  // would cold-compile during the test run — still blowing timeouts with
  // video recording competing for CPU.
  //
  // These GETs all return 401 (no auth header) which is fine — we only need
  // the TypeScript module to be compiled. verifyTier2Request calls connectDB()
  // before checking the token, so the Mongoose connection is also exercised.
  //
  // Routes compiled here but NOT covered by the dashboard warm-up:
  //   /api/tier2/appointments/slots      — called when booking modal date is picked
  //   /api/tier2/appointments            — POST used to book the appointment
  //   /api/tier2/appointments/[id]       — PUT used for check-in / start / complete
  //   /api/tier2/sales                   — POST used to save the sale
  //   /api/tier2/inventory               — GET used to populate medicine datalist
  //   /api/tier2/sales/prescription      — GET used inside the sales modal
  //   /api/tier2/patients                — POST used to create a patient (frontdesk e2e)
  //   /api/tier2/patients/list           — GET used to search patients in booking modal
  //   /api/tier2/templates               — GET/POST used for template list + create
  //   /api/tier2/cosmetology-procedures  — GET/POST used for procedure list + create
  //   /api/tier2/consultation/cosmetology — POST used to save cosmetology consultation
  //
  // WHY add patients/templates/cosmetology routes?
  //   After the pull added cosmetology-procedures and related files, the Next.js
  //   TypeScript compilation graph grew. On the first request to any un-warmed route
  //   (e.g. POST /api/tier2/patients), lazy compilation can take 45+ seconds under
  //   CPU load (headed browser + video recording), blowing the test timeout.
  //   All responses here are 401/405 (no auth) — compilation is the only goal.
  const BASE = 'http://localhost:3000';
  await Promise.allSettled([
    fetch(`${BASE}/api/tier2/appointments/slots`),
    fetch(`${BASE}/api/tier2/appointments`),
    fetch(`${BASE}/api/tier2/appointments/000000000000000000000000`),
    fetch(`${BASE}/api/tier2/sales`),
    fetch(`${BASE}/api/tier2/inventory`),
    fetch(`${BASE}/api/tier2/sales/prescription`),
    fetch(`${BASE}/api/tier2/patients`),
    fetch(`${BASE}/api/tier2/patients/list`),
    fetch(`${BASE}/api/tier2/templates`),
    fetch(`${BASE}/api/tier2/cosmetology-procedures`),
    fetch(`${BASE}/api/tier2/consultation/cosmetology`),
  ]);
}

export default globalSetup;
