import { test, expect } from '@playwright/test';
import { LoginPage }     from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ProfilePage }   from '../pages/ProfilePage';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Logout', () => {

  // Load the saved auth session from global-setup — avoids hitting the login
  // API for every test and bypasses the rate limiter during full-suite runs.
  // The session file holds the auth cookie + localStorage (token, user) that
  // were captured right after the global-setup login.
  test.use({
    storageState: path.join(__dirname, '../playwright/.auth/user.json'),
  });

  // Dashboard load can take up to 45s on a cold server during a full suite run
  test.setTimeout(60000);

  let loginPage:     LoginPage;
  let dashboardPage: DashboardPage;
  let profilePage:   ProfilePage;

  test.beforeEach(async ({ page }) => {
    loginPage     = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    profilePage   = new ProfilePage(page);
  });

  // ── TEST 1: Dashboard logout ──────────────────────────────────────────────
  test('Logout from dashboard — redirected to /login and sign-in form is visible', async ({ page }) => {

    // Step 1: Navigate to dashboard using saved auth session (no login API call)
    await page.goto('/clinic/dashboard');
    await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });
    await expect(page).toHaveURL(/clinic\/dashboard/);

    // Step 2: Click Logout in the dashboard header
    await dashboardPage.logout();

    // Step 3: Verify redirect to /login
    await expect(page).toHaveURL('/login', { timeout: 10000 });

    // Step 4: Verify the sign-in form is showing (not auto-logged back in)
    await expect(loginPage.getSignInButton()).toBeVisible();
    await expect(loginPage.getEmailInput()).toBeVisible();
    await expect(loginPage.getPasswordInput()).toBeVisible();
  });

  // ── TEST 2: localStorage cleared after dashboard logout ───────────────────
  test('Logout from dashboard — token and user removed from localStorage', async ({ page }) => {

    // Step 1: Navigate to dashboard using saved auth session
    await page.goto('/clinic/dashboard');
    await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });

    // Step 2: Confirm token exists before logout
    // WHY evaluate? Playwright's page.evaluate runs code inside the browser,
    // giving direct access to localStorage that is not accessible from test code
    const tokenBefore = await page.evaluate(() => localStorage.getItem('token'));
    expect(tokenBefore).not.toBeNull();

    // Step 3: Logout
    await dashboardPage.logout();
    await expect(page).toHaveURL('/login', { timeout: 10000 });

    // Step 4: Verify both items are cleared
    // localStorage persists across same-origin navigations so we can read it here
    const tokenAfter = await page.evaluate(() => localStorage.getItem('token'));
    const userAfter  = await page.evaluate(() => localStorage.getItem('user'));
    expect(tokenAfter).toBeNull();
    expect(userAfter).toBeNull();
  });

  // ── TEST 3: Protected route guard after dashboard logout ──────────────────
  test('After logout, navigating directly to /clinic/dashboard redirects to /login', async ({ page }) => {

    // Step 1: Navigate to dashboard and logout
    await page.goto('/clinic/dashboard');
    await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });
    await dashboardPage.logout();
    await expect(page).toHaveURL('/login', { timeout: 10000 });

    // Step 2: Try to access the protected dashboard page directly
    await page.goto('/clinic/dashboard');

    // Step 3: App checks localStorage → no token → redirects to /login
    // WHY 10000ms? the redirect is client-side (Next.js router.push) so it takes
    // a full page load + React mount + useEffect before the redirect fires
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });

  // ── TEST 4: Logout from profile page ─────────────────────────────────────
  test('Logout from profile page — redirected to /login and sign-in form is visible', async ({ page }) => {

    // Step 1: Navigate to dashboard using saved session, then go to profile
    await page.goto('/clinic/dashboard');
    await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });
    await dashboardPage.goToProfile();
    await expect(page).toHaveURL(/clinic\/profile/);

    // Step 2: Click the bottom Logout button on the profile page
    // WHY bottom button? profile has button.w-full (full-width) Logout at the bottom
    // that is distinct from any header buttons — ProfilePage scopes to it with button.w-full
    await profilePage.clickLogout();

    // Step 3: Verify redirect to /login with form showing
    await expect(page).toHaveURL('/login', { timeout: 10000 });
    await expect(loginPage.getSignInButton()).toBeVisible();
    await expect(loginPage.getEmailInput()).toBeVisible();
  });

  // ── TEST 5: Protected route guard after profile logout ────────────────────
  test('After profile logout, navigating directly to /clinic/profile redirects to /login', async ({ page }) => {

    // Step 1: Navigate to dashboard, go to profile, then logout
    await page.goto('/clinic/dashboard');
    await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });
    await dashboardPage.goToProfile();
    await profilePage.clickLogout();
    await expect(page).toHaveURL('/login', { timeout: 10000 });

    // Step 2: Try to access the protected profile page directly
    await page.goto('/clinic/profile');

    // Step 3: No token → redirected back to /login
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });

});
