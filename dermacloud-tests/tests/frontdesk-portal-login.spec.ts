import { test, expect } from '@playwright/test';
import { FrontdeskLoginPage }     from '../pages/FrontdeskLoginPage';
import { FrontdeskDashboardPage } from '../pages/FrontdeskDashboardPage';

// ─────────────────────────────────────────────────────────────────────────────
// FILE: frontdesk-portal-login.spec.ts
// PAGE UNDER TEST: /frontdesk/login  (Frontdesk Staff Portal login screen)
//
// WHY NO storageState:
//   The doctor/admin portal persists auth in an HttpOnly cookie, which
//   Playwright's storageState mechanism can save and restore.
//   The frontdesk portal uses localStorage instead:
//     localStorage.setItem('frontdeskToken', token)
//     localStorage.setItem('frontdeskStaff', JSON.stringify(staff))
//   localStorage is NOT captured in storageState snapshots (only cookies and
//   sessionStorage are). There is therefore no auth file to pre-load — every
//   test that needs an authenticated session must go through the real login UI.
//
// TESTS COVERED:
//   1. Successful login — verifies URL changes to /frontdesk/dashboard and the
//      personalised welcome heading is visible (confirms localStorage was written
//      and the React shell consumed it correctly).
//
//   2. Wrong password — verifies the red error container appears and the URL
//      stays on /frontdesk/login (no redirect on failure).
//
//   3. Login then logout — verifies the full round-trip: successful auth,
//      then clicking Logout clears the session and returns to /frontdesk/login.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Frontdesk Staff Portal — Login Flow', () => {

  let loginPage:     FrontdeskLoginPage;
  let dashboardPage: FrontdeskDashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage     = new FrontdeskLoginPage(page);
    dashboardPage = new FrontdeskDashboardPage(page);
  });

  // ── TEST 1: Successful login ──────────────────────────────────────────────
  // Verifies that correct credentials:
  //   • redirect the browser to /frontdesk/dashboard
  //   • cause the welcome heading ("Good {Morning/Afternoon/Evening}, …!") to appear
  // The welcome heading is the most reliable load signal because it is only
  // rendered after the app reads and parses the staff object from localStorage.
  test('Successful login — URL becomes /frontdesk/dashboard and welcome heading is visible', async ({ page }) => {

    // ── Step 1: Open the frontdesk login page ────────────────────────────────
    await loginPage.navigate();

    // ── Step 2: Submit valid credentials ────────────────────────────────────
    // Credentials are injected via environment variables so they are never
    // hard-coded in the test suite
    await loginPage.login(process.env.FRONTDESK_EMAIL!, process.env.FRONTDESK_PASSWORD!);

    // ── Step 3: Wait for the redirect to complete ────────────────────────────
    // WHY 30000ms? the login API call + Next.js client-side navigation can take
    // several seconds when the server is cold or under load
    await page.waitForURL(/frontdesk\/dashboard/, { timeout: 30000 });

    // ── Step 4: Wait for the dashboard shell to finish rendering ─────────────
    await dashboardPage.waitForLoad();

    // ── Step 5: Assert final URL ──────────────────────────────────────────────
    await expect(page).toHaveURL(/frontdesk\/dashboard/);

    // ── Step 6: Assert welcome heading is visible ────────────────────────────
    await expect(dashboardPage.getWelcomeHeading()).toBeVisible();
  });

  // ── TEST 2: Wrong password ────────────────────────────────────────────────
  // Verifies that incorrect credentials:
  //   • show the red error container (div.bg-red-50.border-red-200)
  //   • keep the URL on /frontdesk/login (no accidental redirect)
  test('Wrong password — error message visible, URL stays on /frontdesk/login', async ({ page }) => {

    // ── Step 1: Open the frontdesk login page ────────────────────────────────
    await loginPage.navigate();

    // ── Step 2: Submit correct email but deliberately wrong password ─────────
    // WHY not a random email? using the real email isolates the failure to the
    // password check — a non-existent email might produce a different error path
    await loginPage.login(process.env.FRONTDESK_EMAIL!, 'WrongPassword@999');

    // ── Step 3: Assert the error container is visible ────────────────────────
    // WHY 15000ms? the API may be slow to respond (DB connection + error path)
    // Same reasoning as login.spec.ts error test — 5000ms timed out in practice
    await expect(loginPage.getErrorDiv()).toBeVisible({ timeout: 15000 });

    // ── Step 4: Confirm the URL did not change ───────────────────────────────
    await expect(page).toHaveURL('/frontdesk/login');
  });

  // ── TEST 3: Successful login then logout ──────────────────────────────────
  // Verifies the full session round-trip:
  //   login → dashboard → logout → back to /frontdesk/login
  // Confirms that the Logout button clears localStorage and redirects correctly
  test('Successful login then logout — URL returns to /frontdesk/login', async ({ page }) => {

    // ── Step 1: Open the frontdesk login page ────────────────────────────────
    await loginPage.navigate();

    // ── Step 2: Submit valid credentials ────────────────────────────────────
    await loginPage.login(process.env.FRONTDESK_EMAIL!, process.env.FRONTDESK_PASSWORD!);

    // ── Step 3: Wait for the redirect to /frontdesk/dashboard ───────────────
    await page.waitForURL(/frontdesk\/dashboard/, { timeout: 30000 });

    // ── Step 4: Wait for the dashboard to finish rendering ───────────────────
    await dashboardPage.waitForLoad();

    // ── Step 5: Click Logout ──────────────────────────────────────────────────
    await dashboardPage.logout();

    // ── Step 6: Wait for redirect back to /frontdesk/login ───────────────────
    // WHY 15000ms? clearing localStorage + router.push can take a moment;
    // 15 s is generous but avoids false failures on slow CI machines
    await page.waitForURL(/frontdesk\/login/, { timeout: 15000 });

    // ── Step 7: Assert final URL is the login page ───────────────────────────
    await expect(page).toHaveURL(/frontdesk\/login/);
  });

});
