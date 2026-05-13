import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { ProfilePage }   from '../pages/ProfilePage';
import { FormsPage }     from '../pages/FormsPage';

// Path to the saved auth token — written by global-setup.ts before any test runs
const AUTH_FILE = 'playwright/.auth/user.json';

// ─── COSMETOLOGY FORM STRUCTURE (from the app) ────────────────────────────────
//
//  Section 1: Patient Information
//    - Skin Type (Fitzpatrick)  — Dropdown   — Optional
//    - Primary Concern          — Paragraph  — Required
//
//  Section 2: Assessment & Analysis
//    - Clinical Findings        — Paragraph  — Optional
//    - Assessment/Diagnosis     — Text       — Optional
//    - Baseline Evaluation      — Paragraph  — Optional
//    - Contraindications Check  — Paragraph  — Optional
//
//  Section 3: Procedure Details
//    - Procedure Name, Treatment Goals, Session Number,
//      Package/Plan, Products & Parameters, Immediate Outcome
//
//  Section 4: Aftercare & Follow-up
//    - Prescription (Rx), Aftercare Instructions,
//      Home Products Recommended, Follow-up Date, Expected Results Timeline
//
//  Section 5: Consent & Risks
//    - Risks Explained, Consent Confirmed
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Navigate to Form Settings AND switch to Cosmetology tab.
// WHY separate from the Dermatology helper? Cosmetology requires an extra click
// (the Cosmetology card button) before the correct sections load.
// storageState has the token so no UI login is needed.
async function goToCosmForms(page: any, formsPage: FormsPage) {
  await formsPage.navigate();
  await formsPage.selectCosmetology();
  await formsPage.waitForCosmetologyLoad();
}

// Save and confirm — same logic as Dermatology tests.
// Waits for "Save Changes" first (proves there IS something to save),
// clicks it, then waits for the button to change back to "Saved".
// WHY NOT wait for the toast? The success toast stays visible for 3.5 s.
// If called in Part B, the Part A toast can still be on screen and the check
// passes BEFORE the Part B API call completes — leaving the DB dirty.
// The "Saved" button state is set inside the API success handler, so it only
// changes AFTER the network request fully completes.
async function saveAndConfirm(formsPage: FormsPage) {
  await expect(formsPage.getHeaderSaveButton()).toContainText('Save Changes');
  await formsPage.clickSaveHeader();
  await expect(formsPage.getHeaderSaveButton()).toContainText('Saved', { timeout: 10000 });
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cosmetology Form Settings', () => {

  // Tell Playwright: for every test in this block, load the saved auth token
  // before creating the browser context — replaces UI login entirely
  test.use({ storageState: AUTH_FILE });

  let dashboardPage: DashboardPage;
  let profilePage:   ProfilePage;
  let formsPage:     FormsPage;

  // ── BEFORE ALL: normalize Cosmetology database state ─────────────────────
  // Runs ONCE before all 7 tests.
  // WHY needed? if a previous test run crashed mid-save, the DB can be left
  // dirty — e.g. "Assessment & Analysis" stuck as "Hidden", "Assessment/Diagnosis"
  // stuck as disabled, or "Clinical Findings" stuck as "Required".
  // This hook detects each wrong state and corrects it before any test asserts.
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page    = await context.newPage();
    const fp      = new FormsPage(page);

    // IMPORTANT: switch to Cosmetology FIRST before reading any state —
    // without this we would be reading Dermatology data, not Cosmetology
    await fp.navigate();
    await fp.selectCosmetology();
    await fp.waitForCosmetologyLoad();

    let needsSave = false;

    // Check 1: "Assessment & Analysis" section should be Active
    // WHY: Test 2 disables it then restores it — if it crashed mid-test,
    // "Hidden" gets stuck in the DB and Test 2 starts in the wrong state
    const sectionBadge = await fp.getSectionBadge('Assessment & Analysis').textContent();
    if (sectionBadge?.includes('Hidden')) {
      await fp.clickSectionToggle('Assessment & Analysis');
      needsSave = true;
    }

    // Check 2: "Assessment/Diagnosis" field should be enabled (green toggle)
    // WHY: Test 3 disables then restores it — dirty state causes Test 3 to fail
    const diagClass = await fp.getFieldToggle('Assessment/Diagnosis').getAttribute('class');
    if (diagClass?.includes('bg-gray-200')) {
      await fp.clickFieldToggle('Assessment/Diagnosis');
      needsSave = true;
    }

    // Check 3: "Clinical Findings" field should be Optional
    // WHY: Test 4 changes it to Required then restores — dirty state causes Test 4 to fail
    const cfText = await fp.getFieldRequiredPill('Clinical Findings').textContent();
    if (cfText?.includes('Required')) {
      await fp.clickFieldRequiredPill('Clinical Findings');
      needsSave = true;
    }

    // One save call covers all three corrections at once
    if (needsSave) {
      await fp.clickSaveHeader();
      await expect(fp.getHeaderSaveButton()).toContainText('Saved', { timeout: 10000 });
    }

    // REQUIRED: beforeAll creates its own context so we must close it manually
    // Playwright does NOT auto-close contexts created inside beforeAll
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    profilePage   = new ProfilePage(page);
    formsPage     = new FormsPage(page);
  });

  // ── TEST 1: Navigation + Cosmetology tab selection ────────────────────────
  // Tests the full user journey: dashboard → profile → forms → switch to Cosmetology.
  // WHY check border-purple-500?
  // The Cosmetology card uses a purple theme. When selected it gets
  // border-purple-500 (the app uses teal for Dermatology, purple for Cosmetology).
  test('Navigate to form settings and switch to Cosmetology — Cosmetology tab becomes selected', async ({ page }) => {

    // Step 1: Start at dashboard — storageState has the token
    await page.goto('/clinic/dashboard');
    await page.waitForURL(/clinic\/dashboard/, { timeout: 15000 });

    // Step 2: Go to profile via dashboard header link
    await dashboardPage.goToProfile();
    await expect(page).toHaveURL(/clinic\/profile/);

    // Step 3: Click the Forms link on the profile page
    await expect(profilePage.getFormsLink()).toBeVisible();
    await profilePage.goToForms();

    // Step 4: Verify we landed on Form Settings — Dermatology is selected by default
    await expect(page).toHaveURL('/clinic/settings/forms');
    await expect(formsPage.getPageHeading()).toHaveText('Form Settings');
    await formsPage.waitForLoad();

    // Default state: Dermatology selected (teal border), Cosmetology not selected
    await expect(formsPage.getDermatologyButton()).toHaveClass(/border-teal-500/);
    await expect(formsPage.getCosmetologyButton()).not.toHaveClass(/border-purple-500/);

    // Step 5: Click Cosmetology — the tab switches
    await formsPage.selectCosmetology();
    await formsPage.waitForCosmetologyLoad();

    // Cosmetology card now has its purple selected border; Dermatology loses teal border
    // WHY border-purple-500? the app uses teal for Dermatology and purple for Cosmetology
    await expect(formsPage.getCosmetologyButton()).toHaveClass(/border-purple-500/);
    await expect(formsPage.getDermatologyButton()).not.toHaveClass(/border-teal-500/);
  });

  // ── TEST 2: Section toggle — disable a section, save, re-enable, save ──────
  // Uses "Assessment & Analysis" — the main clinical section in the Cosmetology form.
  // Verifies: badge Active → Hidden (save) → Active (save),
  //           "Unsaved changes" amber pill tracks state correctly.
  test('Section toggle — disable "Assessment & Analysis", save, re-enable, save', async ({ page }) => {

    await goToCosmForms(page, formsPage);

    // beforeAll guarantees this starts as Active
    await expect(formsPage.getSectionBadge('Assessment & Analysis')).toHaveText('Active');

    // ── Part A: Disable ───────────────────────────────────────────────────────

    await formsPage.clickSectionToggle('Assessment & Analysis');

    // Badge changes immediately in the UI (React state update — no API call yet)
    await expect(formsPage.getSectionBadge('Assessment & Analysis')).toHaveText('Hidden');

    // "Unsaved changes" amber badge appears — confirms a change is pending
    await expect(formsPage.getUnsavedChangesIndicator()).toBeVisible();

    // Header button switches from "Saved" to "Save Changes"
    await expect(formsPage.getHeaderSaveButton()).toContainText('Save Changes');

    // Save — waits for API to complete before returning
    await saveAndConfirm(formsPage);

    // After save: amber badge gone, button back to "Saved"
    await expect(formsPage.getUnsavedChangesIndicator()).not.toBeVisible();
    await expect(formsPage.getHeaderSaveButton()).toContainText('Saved');

    // ── Part B: Restore — toggle back to Active so DB is clean for the next run ─

    await formsPage.clickSectionToggle('Assessment & Analysis');
    await expect(formsPage.getSectionBadge('Assessment & Analysis')).toHaveText('Active');
    await saveAndConfirm(formsPage);
  });

  // ── TEST 3: Field toggle — disable a field, save, re-enable, save ──────────
  // Uses "Assessment/Diagnosis" — an Optional text field in "Assessment & Analysis".
  // Verifies: toggle colour green (bg-green-500) ↔ grey (bg-gray-200) each direction,
  //           save persists correctly via the API both ways.
  test('Field toggle — disable "Assessment/Diagnosis", save, re-enable, save', async ({ page }) => {

    await goToCosmForms(page, formsPage);

    // beforeAll guarantees Assessment/Diagnosis starts enabled (green toggle)
    await expect(formsPage.getFieldToggle('Assessment/Diagnosis')).toHaveClass(/bg-green-500/);

    // ── Part A: Disable ───────────────────────────────────────────────────────

    await formsPage.clickFieldToggle('Assessment/Diagnosis');

    // Toggle turns grey — field is now disabled (hidden from the patient form)
    await expect(formsPage.getFieldToggle('Assessment/Diagnosis')).toHaveClass(/bg-gray-200/);
    await expect(formsPage.getUnsavedChangesIndicator()).toBeVisible();

    await saveAndConfirm(formsPage);

    // ── Part B: Restore ───────────────────────────────────────────────────────

    await formsPage.clickFieldToggle('Assessment/Diagnosis');

    // Toggle returns to green — field is re-enabled
    await expect(formsPage.getFieldToggle('Assessment/Diagnosis')).toHaveClass(/bg-green-500/);
    await saveAndConfirm(formsPage);
  });

  // ── TEST 4: Required/Optional toggle ─────────────────────────────────────
  // Uses "Clinical Findings" — starts as Optional in "Assessment & Analysis".
  // Verifies: Optional → Required (Part A) then Required → Optional (Part B),
  //           each direction persists to the DB via Save.
  test('Required/Optional toggle — "Clinical Findings" from Optional to Required and back', async ({ page }) => {

    await goToCosmForms(page, formsPage);

    // beforeAll guarantees Clinical Findings starts as Optional
    await expect(formsPage.getFieldRequiredPill('Clinical Findings')).toHaveText('Optional');

    // ── Part A: Toggle to Required ────────────────────────────────────────────

    await formsPage.clickFieldRequiredPill('Clinical Findings');

    // Pill label switches immediately in the UI
    await expect(formsPage.getFieldRequiredPill('Clinical Findings')).toHaveText('Required');
    await expect(formsPage.getUnsavedChangesIndicator()).toBeVisible();

    await saveAndConfirm(formsPage);

    // ── Part B: Restore to Optional ──────────────────────────────────────────

    await formsPage.clickFieldRequiredPill('Clinical Findings');
    await expect(formsPage.getFieldRequiredPill('Clinical Findings')).toHaveText('Optional');
    await saveAndConfirm(formsPage);
  });

  // ── TEST 5: Required pill is disabled when its field is disabled ──────────
  // Uses "Baseline Evaluation" — an Optional field in "Assessment & Analysis".
  // Verifies the dependency rule: you cannot mark a field Required if it is
  // disabled (hidden). The pill must become HTML-disabled with tooltip
  // "Enable field first". WHY no save? toggling off then on = net-zero change.
  test('Required pill is disabled when field is disabled — "Baseline Evaluation"', async ({ page }) => {

    await goToCosmForms(page, formsPage);

    // Confirm the field starts enabled and the Required pill is clickable
    await expect(formsPage.getFieldToggle('Baseline Evaluation')).toHaveClass(/bg-green-500/);
    await expect(formsPage.getFieldRequiredPill('Baseline Evaluation')).not.toBeDisabled();

    // Disable the field — no save needed, we are testing UI state only
    await formsPage.clickFieldToggle('Baseline Evaluation');
    await expect(formsPage.getFieldToggle('Baseline Evaluation')).toHaveClass(/bg-gray-200/);

    // Required pill must now be HTML-disabled (disabled={!field.enabled} in source)
    // and must show the tooltip that explains why
    await expect(formsPage.getFieldRequiredPill('Baseline Evaluation')).toBeDisabled();
    await expect(formsPage.getFieldRequiredPill('Baseline Evaluation'))
      .toHaveAttribute('title', 'Enable field first');

    // Re-enable — toggle off then on = zero net change, no save needed
    await formsPage.clickFieldToggle('Baseline Evaluation');
    await expect(formsPage.getFieldToggle('Baseline Evaluation')).toHaveClass(/bg-green-500/);
    await expect(formsPage.getFieldRequiredPill('Baseline Evaluation')).not.toBeDisabled();
  });

  // ── TEST 6: Add custom field, save, delete it, save ───────────────────────
  // Full lifecycle on the "Assessment & Analysis" section:
  //   open modal → fill label + type + placeholder → confirm → save → delete → save.
  // WHY pre-cleanup inside the test (not in beforeAll)?
  //   The toast div shares the same CSS classes as field rows.
  //   In beforeAll the cleanup loop would match the toast text instead of the
  //   real field row and wait forever for a "Remove field" button that doesn't
  //   exist inside a toast.
  //   Here we scope the locator to the section card (div.bg-white.rounded-2xl).
  //   The toast is position:fixed and lives OUTSIDE all section cards in the DOM.
  test('Add custom field to "Assessment & Analysis", save, then delete it, save', async ({ page }) => {

    await goToCosmForms(page, formsPage);

    const customFieldLabel = 'Cosmo Texture Test';

    // ── Pre-cleanup: remove any leftover fields from previous failed runs ─────
    // Scope to the Assessment & Analysis section card to never match the toast
    const aaCard = page.locator('div.bg-white.rounded-2xl')
      .filter({ has: page.locator('h3').filter({ hasText: 'Assessment & Analysis' }) });

    const leftoverRows = aaCard
      .locator('div.flex.items-center.gap-3.px-5')
      .filter({ hasText: customFieldLabel });

    // count() returns the CURRENT element count immediately — correct for while loops
    // WHY force:true? if beforeAll just restored a section, the React re-render may
    // still be in progress; force bypasses the actionability wait
    while (await leftoverRows.count() > 0) {
      await leftoverRows.first().locator('button[title="Remove field"]').click({ force: true });
      await page.getByRole('button', { name: 'Remove', exact: true }).click();
      await page.getByText(`"${customFieldLabel}" removed`).waitFor({ state: 'visible', timeout: 5000 });
    }

    // If pre-cleanup removed anything it left unsaved changes — persist them
    if (await formsPage.getUnsavedChangesIndicator().isVisible()) {
      await saveAndConfirm(formsPage);
    }

    // ── Part A: Add ───────────────────────────────────────────────────────────

    await formsPage.clickAddCustomField('Assessment & Analysis');

    // Modal opens
    await expect(formsPage.getAddFieldModalHeading()).toBeVisible();

    await formsPage.fillFieldLabel(customFieldLabel);
    await formsPage.selectFieldType('text');
    await formsPage.fillFieldPlaceholder('Describe the skin texture');

    await formsPage.clickAddField();

    // Modal closes and a toast confirms the addition
    await expect(formsPage.getAddFieldModalHeading()).not.toBeVisible({ timeout: 5000 });
    await expect(formsPage.getToast(`"${customFieldLabel}" field added`)).toBeVisible({ timeout: 5000 });

    // New field row is now visible inside the section
    await expect(formsPage.getFieldToggle(customFieldLabel)).toBeVisible({ timeout: 5000 });
    await expect(formsPage.getUnsavedChangesIndicator()).toBeVisible();

    await saveAndConfirm(formsPage);

    // ── Part B: Delete (cleanup — leaves DB in the state it was before the test) ─

    await formsPage.clickFieldDelete(customFieldLabel);

    // Confirmation dialog appears with the field name
    await expect(page.getByText(`"${customFieldLabel}"`)).toBeVisible({ timeout: 5000 });

    await formsPage.clickConfirmRemove();

    // Toast confirms removal and the field row disappears
    await expect(formsPage.getToast(`"${customFieldLabel}" removed`)).toBeVisible({ timeout: 5000 });
    await expect(formsPage.getFieldToggle(customFieldLabel)).not.toBeVisible({ timeout: 5000 });

    await saveAndConfirm(formsPage);
  });

  // ── TEST 7: Empty label validation in "Add Custom Field" modal ───────────
  // Verifies that clicking "Add Field" without filling the label shows an
  // inline error message and keeps the modal open (no false submission).
  test('Add custom field — submitting empty label shows "Field label is required."', async ({ page }) => {

    await goToCosmForms(page, formsPage);

    await formsPage.clickAddCustomField('Patient Information');

    // Modal opens
    await expect(formsPage.getAddFieldModalHeading()).toBeVisible();

    // Click "Add Field" immediately — label intentionally left empty
    await formsPage.clickAddField();

    // Error message appears inside the modal
    await expect(formsPage.getModalErrorMessage()).toBeVisible();
    await expect(formsPage.getModalErrorMessage()).toContainText('Field label is required.');

    // Modal must still be open (validation blocked submission)
    await expect(formsPage.getAddFieldModalHeading()).toBeVisible();
  });

});
