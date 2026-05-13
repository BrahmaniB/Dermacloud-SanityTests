import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

// These tests require:
// 1. DermaCloud running locally at http://localhost:3000
// 2. MongoDB connected
// 3. .env file with TEST_EMAIL and TEST_PASSWORD

test.describe('DermaCloud Dashboard', () => {

  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  // Before each test — login and land on the dashboard
  // WHY in beforeEach: every dashboard test needs a logged-in user
  // so we do the login step once before each test automatically
  test.beforeEach(async ({ page }) => {
    loginPage     = new LoginPage(page);
    dashboardPage = new DashboardPage(page);

    // Step 1: Go to login page
    await loginPage.navigate();

    // Step 2: Login with real credentials from .env file
    // process.env reads the value from .env
    // The "!" tells TypeScript: trust me, this value exists
    await loginPage.login(
      process.env.TEST_EMAIL!,
      process.env.TEST_PASSWORD!
    );

    // Step 3: Wait for the full redirect chain to complete
    // /login → stores token → /dashboard → /clinic/dashboard
    // WHY regex? More reliable than glob pattern (**)
    // WHY 30000ms? Login API + 500ms setTimeout + two redirects can take 15-25 seconds locally
    await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });
  });

  // TEST 1: Verify we landed on the correct dashboard
  // and the clinic name is visible
  test('should show clinic name after login', async ({ page }) => {

    // Check URL is correct
    await expect(page).toHaveURL(/clinic\/dashboard/);

    // Check "DermaCloud" h1 is visible in the header
    await expect(dashboardPage.getAppName()).toBeVisible();
    await expect(dashboardPage.getAppName()).toHaveText('DermaCloud');

    // Check the clinic name "Dr. Test" is visible
    // This confirms we are logged in as the correct user
    await expect(dashboardPage.getClinicName()).toBeVisible();
    await expect(dashboardPage.getClinicName()).toContainText(process.env.TEST_CLINIC_NAME!);
  });

  // TEST 2: Verify all navigation links are visible
  test('should show all navigation links', async () => {
    await expect(dashboardPage.getNavDashboard()).toBeVisible();
    await expect(dashboardPage.getNavPatients()).toBeVisible();
    await expect(dashboardPage.getNavConsultations()).toBeVisible();
    await expect(dashboardPage.getNavPharmacy()).toBeVisible();
    await expect(dashboardPage.getNavTemplates()).toBeVisible();
    await expect(dashboardPage.getNavAnalytics()).toBeVisible();
    await expect(dashboardPage.getNavFrontdesk()).toBeVisible();
  });

  // TEST 3: Click Profile and verify navigation
  test('should navigate to profile when Profile is clicked', async ({ page }) => {

    // Verify Profile link is visible first
    await expect(dashboardPage.getProfileLink()).toBeVisible();

    // Click it
    await dashboardPage.goToProfile();

    // Verify we landed on the profile page
    await expect(page).toHaveURL(/clinic\/profile/);
  });

});
