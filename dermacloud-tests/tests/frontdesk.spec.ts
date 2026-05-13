import { test, expect } from '@playwright/test';
import { LoginPage }     from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ProfilePage }   from '../pages/ProfilePage';
import { FrontdeskPage } from '../pages/FrontdeskPage';

// Helper — logs in and waits for dashboard to load
// WHY a helper function? all 3 tests need login + wait for dashboard
// Instead of repeating the same code 3 times, we write it once here
async function loginAndWaitForDashboard(page: any, loginPage: LoginPage) {
  await loginPage.navigate();
  await loginPage.login(
    process.env.TEST_EMAIL!,
    process.env.TEST_PASSWORD!
  );
  await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });
}

// Helper — opens modal, reads count before, fills form, submits, verifies count+1
// WHY a helper? all 3 tests do the exact same add staff steps
// Change it here once → all 3 tests updated automatically
async function addStaffAndVerifyCount(
  page: any,
  frontdeskPage: FrontdeskPage,
  staffData: { name: string; email: string; password: string; phone: string }
) {
  // Wait for staff list to fully load before reading count
  // WHY waitForStaffList? React briefly shows "0 staff members" before API responds
  // networkidle misses this because the page is already idle when useEffect fetch starts
  // waitForStaffList waits for Edit buttons or empty-state to confirm data is ready
  await frontdeskPage.waitForStaffList();
  const countBefore = await frontdeskPage.getStaffCount();

  // Click Add Staff button (top right)
  await frontdeskPage.clickAddStaff();

  // Verify modal opened — check heading is visible
  await expect(frontdeskPage.getModalHeading()).toBeVisible();

  // Fill the form
  await frontdeskPage.fillStaffDetails(staffData);

  // Submit the form
  await frontdeskPage.clickSubmit();

  // Wait for modal to close — modal heading should disappear
  // WHY 10000ms? API call to save staff takes a moment
  await expect(frontdeskPage.getModalHeading()).not.toBeVisible({ timeout: 10000 });

  // Verify success toast appeared — must check BEFORE it auto-dismisses (4s window)
  // Source: showToast("Frontdesk staff added successfully!", "success") on line 103
  await expect(frontdeskPage.getSuccessToast()).toBeVisible({ timeout: 5000 });

  // Verify count increased by exactly 1
  // toContainText has BUILT-IN RETRY — Playwright polls until text matches or times out
  const expectedCount = countBefore + 1;
  const expectedText  = expectedCount === 1 ? '1 staff member' : `${expectedCount} staff members`;
  await expect(frontdeskPage.getStaffCountText()).toContainText(expectedText, { timeout: 10000 });

  // Verify the new staff card shows Edit and Deactivate buttons
  // Scoped to the row that contains the staff name — avoids matching other rows
  await expect(frontdeskPage.getEditButtonForStaff(staffData.name)).toBeVisible({ timeout: 5000 });
  await expect(frontdeskPage.getDeactivateButtonForStaff(staffData.name)).toBeVisible({ timeout: 5000 });
}

// ─────────────────────────────────────────────────────────────
test.describe('Frontdesk Staff — Add Staff via 3 Navigation Paths', () => {

  let loginPage:     LoginPage;
  let dashboardPage: DashboardPage;
  let profilePage:   ProfilePage;
  let frontdeskPage: FrontdeskPage;

  test.beforeEach(async ({ page }) => {
    loginPage     = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    profilePage   = new ProfilePage(page);
    frontdeskPage = new FrontdeskPage(page);
  });

  // ── TEST 1: Dashboard nav bar → Frontdesk ─────────────────
  test('Way 1 — navigate to frontdesk via dashboard nav bar and add staff', async ({ page }) => {

    // Step 1: Login and land on dashboard
    await loginAndWaitForDashboard(page, loginPage);

    // Step 2: Verify dashboard loaded with correct clinic name
    await expect(dashboardPage.getClinicName()).toBeVisible();

    // Step 3: Click Frontdesk in the dashboard navigation bar
    await dashboardPage.goToFrontdesk();

    // Step 4: Verify we landed on the frontdesk page
    await expect(page).toHaveURL(/clinic\/settings\/frontdesk/);
    await expect(frontdeskPage.getPageHeading()).toHaveText('Frontdesk Staff');

    // Step 5: Add staff and verify count increased by 1
    const ts1 = Date.now();
    await addStaffAndVerifyCount(page, frontdeskPage, {
      name:     'Staff One',
      email:    `staffone${ts1}@dermacloud.com`,
      password: 'Staff@123',
      phone:    '9876543210',
    });
  });

  // ── TEST 2: Profile nav bar → Frontdesk ───────────────────
  test('Way 2 — navigate to frontdesk via profile page nav bar and add staff', async ({ page }) => {

    // Step 1: Login and land on dashboard
    await loginAndWaitForDashboard(page, loginPage);

    // Step 2: Click Profile link in the dashboard header
    await dashboardPage.goToProfile();
    await expect(page).toHaveURL(/clinic\/profile/);

    // Step 3: Verify profile page loaded correctly
    await expect(profilePage.getProfileHeading()).toBeVisible();

    // Step 4: Click Frontdesk in the profile page navigation bar
    await profilePage.goToFrontdeskViaNav();

    // Step 5: Verify we landed on the frontdesk page
    await expect(page).toHaveURL(/clinic\/settings\/frontdesk/);
    await expect(frontdeskPage.getPageHeading()).toHaveText('Frontdesk Staff');

    // Step 6: Add staff and verify count increased by 1
    const ts2 = Date.now();
    await addStaffAndVerifyCount(page, frontdeskPage, {
      name:     'Staff Two',
      email:    `stafftwo${ts2}@dermacloud.com`,
      password: 'Staff@123',
      phone:    '9876543211',
    });
  });

  // ── TEST 3: Profile Frontdesk Staff card → Frontdesk ──────
  test('Way 3 — navigate to frontdesk via profile page card and add staff', async ({ page }) => {

    // Step 1: Login and land on dashboard
    await loginAndWaitForDashboard(page, loginPage);

    // Step 2: Click Profile link in the dashboard header
    await dashboardPage.goToProfile();
    await expect(page).toHaveURL(/clinic\/profile/);

    // Step 3: Verify profile page loaded correctly
    await expect(profilePage.getProfileHeading()).toBeVisible();

    // Step 4: Click the Frontdesk Staff card on the profile page
    await profilePage.goToFrontdeskViaCard();

    // Step 5: Verify we landed on the frontdesk page
    await expect(page).toHaveURL(/clinic\/settings\/frontdesk/);
    await expect(frontdeskPage.getPageHeading()).toHaveText('Frontdesk Staff');

    // Step 6: Add staff and verify count increased by 1
    const ts3 = Date.now();
    await addStaffAndVerifyCount(page, frontdeskPage, {
      name:     'Staff Three',
      email:    `staffthree${ts3}@dermacloud.com`,
      password: 'Staff@123',
      phone:    '9876543212',
    });
  });

});
