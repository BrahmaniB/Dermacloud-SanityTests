import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { ProfilePage }   from '../pages/ProfilePage';
import { FormsPage }     from '../pages/FormsPage';

// Path to the saved auth token — written by global-setup.ts before any test runs
const AUTH_FILE = 'playwright/.auth/user.json';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Navigate directly to Form Settings — auth token is pre-loaded from AUTH_FILE,
// so the app considers us already logged in without touching the login page
async function goToForms(page: any, formsPage: FormsPage) {
  await formsPage.navigate();
  await formsPage.waitForLoad();
}

// Save and confirm — waits for "Save Changes", clicks, then waits for button to return to "Saved"
// WHY wait for "Saved" button and NOT the toast?
// The success toast stays visible for 3.5s. If saveAndConfirm is called in Part B of a test,
// the Part A toast may still be on screen, causing the toast check to pass BEFORE the
// Part B API call completes. The browser context then closes, cancelling the in-flight request.
// The "Saved" button state is set by setHasChanges(false) inside the API success handler —
// it only changes AFTER the API call returns, so it is a reliable completion signal.
async function saveAndConfirm(formsPage: FormsPage) {
  await expect(formsPage.getHeaderSaveButton()).toContainText('Save Changes');
  await formsPage.clickSaveHeader();
  await expect(formsPage.getHeaderSaveButton()).toContainText('Saved', { timeout: 10000 });
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Form Settings', () => {

  // Tell Playwright: for every test in this block, load the saved auth token
  // before creating the browser context — this replaces UI login entirely
  // WHY? the login API has a rate limiter; after ~3 rapid logins it blocks further
  // attempts with "Too many login attempts" and all subsequent tests time out
  test.use({ storageState: AUTH_FILE });

  let dashboardPage: DashboardPage;
  let profilePage:   ProfilePage;
  let formsPage:     FormsPage;

  // ── BEFORE ALL: normalize database state ─────────────────────────────────
  // Runs ONCE before all 7 tests — not before each individual test
  // WHY? if a previous test run crashed mid-save, the DB can be left dirty:
  //   - Clinical Examination stuck as "Hidden"
  //   - Duration field stuck as disabled
  //   - Previous Treatment stuck as "Required"
  // This hook detects each wrong state and corrects it before any test asserts
  test.beforeAll(async ({ browser }) => {
    // Create a fresh context with the auth token already loaded
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page    = await context.newPage();
    const fp      = new FormsPage(page);

    await fp.navigate();
    await fp.waitForLoad();

    let needsSave = false;

    // Check 1: Clinical Examination should be Active
    const sectionBadge = await fp.getSectionBadge('Clinical Examination').textContent();
    if (sectionBadge?.includes('Hidden')) {
      await fp.clickSectionToggle('Clinical Examination');
      needsSave = true;
    }

    // Check 2: Duration should be enabled (green toggle)
    const durationClass = await fp.getFieldToggle('Duration').getAttribute('class');
    if (durationClass?.includes('bg-gray-200')) {
      await fp.clickFieldToggle('Duration');
      needsSave = true;
    }

    // Check 3: Previous Treatment should be Optional
    const ptText = await fp.getFieldRequiredPill('Previous Treatment').textContent();
    if (ptText?.includes('Required')) {
      await fp.clickFieldRequiredPill('Previous Treatment');
      needsSave = true;
    }

    // Save all corrections at once — one API call for all three fixes
    if (needsSave) {
      await fp.clickSaveHeader();
      await expect(fp.getHeaderSaveButton()).toContainText('Saved', { timeout: 10000 });
    }

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    profilePage   = new ProfilePage(page);
    formsPage     = new FormsPage(page);
  });

  // ── TEST 1: Navigation path — dashboard → profile → form settings ──────────
  // Tests the exact user journey: open dashboard, go to profile, click Forms link
  // We still test the navigation path — we just skip the login step since auth
  // is pre-loaded (the test is about profile→forms navigation, not login)
  test('Navigate to form settings via profile page — page loads with Dermatology selected', async ({ page }) => {

    // Step 1: Start at dashboard — storageState has the token, app treats us as logged in
    await page.goto('/clinic/dashboard');
    await page.waitForURL(/clinic\/dashboard/, { timeout: 15000 });

    // Step 2: Go to profile via dashboard header link
    await dashboardPage.goToProfile();
    await expect(page).toHaveURL(/clinic\/profile/);

    // Step 3: Click the Forms link on the profile page
    await expect(profilePage.getFormsLink()).toBeVisible();
    await profilePage.goToForms();

    // Step 4: Verify we landed on the correct page
    await expect(page).toHaveURL('/clinic/settings/forms');
    await expect(formsPage.getPageHeading()).toHaveText('Form Settings');

    // Step 5: Wait for sections to load, then verify the default state
    await formsPage.waitForLoad();

    // Dermatology should be selected by default (border-teal-500 = selected card)
    await expect(formsPage.getDermatologyButton()).toHaveClass(/border-teal-500/);
    await expect(formsPage.getCosmetologyButton()).not.toHaveClass(/border-teal-500/);
  });

  // ── TEST 2: Section toggle — disable a section, save, re-enable, save ──────
  test('Section toggle — disable "Clinical Examination", save, re-enable, save', async ({ page }) => {

    await goToForms(page, formsPage);

    // beforeAll guarantees this starts as Active
    await expect(formsPage.getSectionBadge('Clinical Examination')).toHaveText('Active');

    // ── Part A: Disable ───────────────────────────────────────────────────────

    await formsPage.clickSectionToggle('Clinical Examination');
    await expect(formsPage.getSectionBadge('Clinical Examination')).toHaveText('Hidden');
    await expect(formsPage.getUnsavedChangesIndicator()).toBeVisible();
    await expect(formsPage.getHeaderSaveButton()).toContainText('Save Changes');

    await saveAndConfirm(formsPage);

    await expect(formsPage.getUnsavedChangesIndicator()).not.toBeVisible();
    await expect(formsPage.getHeaderSaveButton()).toContainText('Saved');

    // ── Part B: Restore ───────────────────────────────────────────────────────

    await formsPage.clickSectionToggle('Clinical Examination');
    await expect(formsPage.getSectionBadge('Clinical Examination')).toHaveText('Active');
    await saveAndConfirm(formsPage);
  });

  // ── TEST 3: Field toggle — disable "Duration" field, save, re-enable, save ─
  test('Field toggle — disable "Duration", save, re-enable, save', async ({ page }) => {

    await goToForms(page, formsPage);

    // beforeAll guarantees Duration starts enabled (green)
    await expect(formsPage.getFieldToggle('Duration')).toHaveClass(/bg-green-500/);

    // ── Part A: Disable ───────────────────────────────────────────────────────

    await formsPage.clickFieldToggle('Duration');
    await expect(formsPage.getFieldToggle('Duration')).toHaveClass(/bg-gray-200/);
    await expect(formsPage.getUnsavedChangesIndicator()).toBeVisible();

    await saveAndConfirm(formsPage);

    // ── Part B: Restore ───────────────────────────────────────────────────────

    await formsPage.clickFieldToggle('Duration');
    await expect(formsPage.getFieldToggle('Duration')).toHaveClass(/bg-green-500/);
    await saveAndConfirm(formsPage);
  });

  // ── TEST 4: Required/Optional toggle on "Previous Treatment" ──────────────
  test('Required/Optional toggle — "Previous Treatment" from Optional to Required and back', async ({ page }) => {

    await goToForms(page, formsPage);

    // beforeAll guarantees Previous Treatment starts as Optional
    await expect(formsPage.getFieldRequiredPill('Previous Treatment')).toHaveText('Optional');

    // ── Part A: Toggle to Required ────────────────────────────────────────────

    await formsPage.clickFieldRequiredPill('Previous Treatment');
    await expect(formsPage.getFieldRequiredPill('Previous Treatment')).toHaveText('Required');
    await expect(formsPage.getUnsavedChangesIndicator()).toBeVisible();

    await saveAndConfirm(formsPage);

    // ── Part B: Restore ───────────────────────────────────────────────────────

    await formsPage.clickFieldRequiredPill('Previous Treatment');
    await expect(formsPage.getFieldRequiredPill('Previous Treatment')).toHaveText('Optional');
    await saveAndConfirm(formsPage);
  });

  // ── TEST 5: Required pill is disabled when its field is disabled ──────────
  test('Required pill is disabled when field is disabled — "Lesion Site"', async ({ page }) => {

    await goToForms(page, formsPage);

    // Confirm field starts enabled and pill is clickable
    await expect(formsPage.getFieldToggle('Lesion Site')).toHaveClass(/bg-green-500/);
    await expect(formsPage.getFieldRequiredPill('Lesion Site')).not.toBeDisabled();

    // Disable the field — no save needed, we're testing UI state only
    await formsPage.clickFieldToggle('Lesion Site');
    await expect(formsPage.getFieldToggle('Lesion Site')).toHaveClass(/bg-gray-200/);

    // Required pill must now be HTML-disabled (disabled={!field.enabled} in source)
    await expect(formsPage.getFieldRequiredPill('Lesion Site')).toBeDisabled();
    await expect(formsPage.getFieldRequiredPill('Lesion Site'))
      .toHaveAttribute('title', 'Enable field first');

    // Re-enable — net change = zero, no save needed
    // WHY no save? toggling off then on = net change of zero
    await formsPage.clickFieldToggle('Lesion Site');
    await expect(formsPage.getFieldToggle('Lesion Site')).toHaveClass(/bg-green-500/);
    await expect(formsPage.getFieldRequiredPill('Lesion Site')).not.toBeDisabled();
  });

  // ── TEST 6: Add custom field, save, then delete it, save ──────────────────
  test('Add custom field to "Clinical Examination", save, then delete it, save', async ({ page }) => {

    await goToForms(page, formsPage);

    const customFieldLabel = 'Skin Texture Test';

    // ── Pre-cleanup: remove any leftover fields from previous failed runs ─────
    // WHY here and not in beforeAll?
    // The toast div uses the same CSS classes as field rows (flex items-center gap-3 px-5).
    // In beforeAll the cleanup loop would match the toast instead of the field row and then
    // wait forever for a "Remove field" button that doesn't exist inside a toast.
    // Here we scope the search to inside the Clinical Examination section card,
    // which is a div.bg-white.rounded-2xl — the toast is position:fixed and lives outside it.
    // WHY force:true? if the section was just made Active by beforeAll, the React re-render
    // may still be completing; force bypasses the actionability wait.
    const ceCard = page.locator('div.bg-white.rounded-2xl')
      .filter({ has: page.locator('h3').filter({ hasText: 'Clinical Examination' }) });
    const leftoverRows = ceCard
      .locator('div.flex.items-center.gap-3.px-5')
      .filter({ hasText: customFieldLabel });
    while (await leftoverRows.count() > 0) {
      await leftoverRows.first().locator('button[title="Remove field"]').click({ force: true });
      await page.getByRole('button', { name: 'Remove', exact: true }).click();
      await page.getByText(`"${customFieldLabel}" removed`).waitFor({ state: 'visible', timeout: 5000 });
    }
    if (await formsPage.getUnsavedChangesIndicator().isVisible()) {
      await saveAndConfirm(formsPage);
    }

    // ── Part A: Add ───────────────────────────────────────────────────────────

    await formsPage.clickAddCustomField('Clinical Examination');
    await expect(formsPage.getAddFieldModalHeading()).toBeVisible();

    await formsPage.fillFieldLabel(customFieldLabel);
    await formsPage.selectFieldType('text');
    await formsPage.fillFieldPlaceholder('Describe the skin texture');

    await formsPage.clickAddField();

    // Modal closes, toast appears, field row appears in the section
    await expect(formsPage.getAddFieldModalHeading()).not.toBeVisible({ timeout: 5000 });
    await expect(formsPage.getToast(`"${customFieldLabel}" field added`)).toBeVisible({ timeout: 5000 });
    await expect(formsPage.getFieldToggle(customFieldLabel)).toBeVisible({ timeout: 5000 });
    await expect(formsPage.getUnsavedChangesIndicator()).toBeVisible();

    await saveAndConfirm(formsPage);

    // ── Part B: Delete (cleanup) ──────────────────────────────────────────────

    await formsPage.clickFieldDelete(customFieldLabel);
    await expect(page.getByText(`"${customFieldLabel}"`)).toBeVisible({ timeout: 5000 });
    await formsPage.clickConfirmRemove();
    await expect(formsPage.getToast(`"${customFieldLabel}" removed`)).toBeVisible({ timeout: 5000 });
    await expect(formsPage.getFieldToggle(customFieldLabel)).not.toBeVisible({ timeout: 5000 });

    await saveAndConfirm(formsPage);
  });

  // ── TEST 7: Empty label validation ────────────────────────────────────────
  test('Add custom field — submitting empty label shows "Field label is required."', async ({ page }) => {

    await goToForms(page, formsPage);

    await formsPage.clickAddCustomField('Patient Information');
    await expect(formsPage.getAddFieldModalHeading()).toBeVisible();

    // Do NOT fill label — click immediately to trigger validation
    await formsPage.clickAddField();

    // Error appears inside the modal, modal stays open
    await expect(formsPage.getModalErrorMessage()).toBeVisible();
    await expect(formsPage.getModalErrorMessage()).toContainText('Field label is required.');
    await expect(formsPage.getAddFieldModalHeading()).toBeVisible();
  });

});
