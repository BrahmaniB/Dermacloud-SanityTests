import { test, expect } from '@playwright/test';
import { FrontdeskPage } from '../pages/FrontdeskPage';

// ─────────────────────────────────────────────────────────────────────────────
// FILE: frontdesk-edit.spec.ts
// COVERS: Edit Staff flow on /clinic/settings/frontdesk
//
// WHAT THIS TEST DOES:
//   Adds a fresh staff member, clicks Edit on their card, verifies the modal
//   pre-fills their name and phone from the DB, changes both values, saves,
//   and asserts the success toast and updated staff card.
//
// ── KEY DOM DISCOVERIES (found by reading failure screenshots) ────────────────
//
//   Add modal heading  →  "Add Frontdesk Staff"  (h3)
//   Edit modal heading →  "Edit Staff"            (h3)  ← NOT "Edit Frontdesk Staff"
//
//   Edit modal form structure (confirmed from DevTools):
//     <form class="p-6 space-y-4">
//       <div>
//         <label>Full Name *</label>          ← no `for` attribute
//         <input type="text" value="...">     ← no `id`, no placeholder when pre-filled
//       </div>
//       <div>
//         <label>Email (cannot change)</label>
//         <input type="email" disabled>       ← read-only, cannot be edited
//       </div>
//       <div>
//         <label> </label>                    ← blank label for password field
//         <input type="password" placeholder="Enter new password">
//       </div>
//       <div>
//         <label>Phone *</label>              ← no `for` attribute
//         <input type="tel" value="...">      ← no `id`, no placeholder when pre-filled
//       </div>
//     </form>
//
//   Submit button  →  "Save Changes"  (getByRole button)
//                     NOT type="submit" like the Add modal
//
// ── LOCATOR STRATEGY LESSONS ─────────────────────────────────────────────────
//
//   ✗  getByPlaceholder('Staff member name')
//      Fails in the edit modal — the name input has NO placeholder attribute.
//      getByPlaceholder only works when the input is empty and the placeholder
//      text is actually set. Pre-filled inputs keep their placeholder attribute
//      but this modal's component simply never sets one.
//
//   ✗  getByLabel('FULL NAME', { exact: false })
//      Fails because getByLabel requires the label to be LINKED to its input via:
//        • <label for="someId"> + <input id="someId">   (explicit association)
//        • <label><input></label>                        (implicit wrapping)
//      In this form, labels and inputs are just siblings inside a <div> —
//      no `for`, no `id` — so Playwright cannot associate them.
//      Note: the label text appears UPPERCASE visually (CSS text-transform),
//      but the actual HTML is "Full Name *" — this also caused a mismatch.
//
//   ✓  page.locator('form input[type="text"]')   →  Full Name
//      page.locator('form input[type="tel"]')    →  Phone
//      Works because each input type appears exactly ONCE in the form.
//      Scoping to `form` prevents matching any stray inputs outside the modal.
//
// ── TIMEOUT LESSON ───────────────────────────────────────────────────────────
//
//   The "Staff updated successfully!" toast failed at { timeout: 5000 }.
//   The failure screenshot showed the toast HAD appeared — just after the 5 s
//   deadline. "element(s) not found" means it never appeared within the window,
//   not that it appeared and disappeared.
//   Fix: use { timeout: 10000 } for any toast that follows a POST/PUT API call.
//   The toast auto-dismiss timer only starts when the toast appears, so a longer
//   wait does NOT risk missing it once it shows up.
//
// ── DEBUGGING TECHNIQUE ──────────────────────────────────────────────────────
//
//   Every failure generates a screenshot in test-results/.
//   Reading that screenshot immediately shows whether:
//     • the modal opened at all          (heading visible or not)
//     • the form is pre-filled           (input values visible)
//     • the toast appeared               (toast text visible or not)
//   This is faster than adding console.log statements or re-running with --debug.
//
// ─────────────────────────────────────────────────────────────────────────────

// Path to the saved auth token — written by global-setup.ts before any test runs
// WHY storageState? the login API has a rate limiter; after ~3 rapid logins it blocks
// further attempts. Using the pre-saved token skips the login UI entirely.
const AUTH_FILE = 'playwright/.auth/user.json';

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Frontdesk Staff — Edit Staff', () => {

  // Load the saved auth token for every test in this block — no UI login needed
  test.use({ storageState: AUTH_FILE });

  let frontdeskPage: FrontdeskPage;

  test.beforeEach(async ({ page }) => {
    frontdeskPage = new FrontdeskPage(page);
  });

  // ── TEST: Click Edit, verify pre-fill, change name/phone, verify toast ──────
  // Full end-to-end edit flow:
  //   1. Add a fresh staff member (unique timestamp name) → gives us known name/phone
  //   2. Click Edit on that staff card → modal opens
  //   3. Assert modal is pre-filled with the original name and phone
  //   4. Change name and phone → submit
  //   5. Assert "Staff updated successfully!" toast
  //   6. Assert modal closed and staff card now shows the new name
  test('Edit staff — modal opens pre-filled with name and phone, change values, verify "Staff updated successfully!" toast', async ({ page }) => {

    // ── Step 1: Navigate to Frontdesk page ───────────────────────────────────
    // storageState already has the auth cookie — the app treats us as logged in
    await page.goto('/clinic/settings/frontdesk');

    // WHY waitForStaffList? React shows "0 staff members" on first paint before the
    // useEffect API call returns. This waits until Edit buttons (or empty-state) appear.
    await frontdeskPage.waitForStaffList();

    // ── Step 2: Add a fresh staff member so we know the exact name and phone ──
    // WHY add here and not in beforeAll?
    // We need to assert exact pre-filled values in the modal. Using a timestamp-based
    // name guarantees the name/phone are 100% unique — no leftover from previous runs.
    const ts           = Date.now();
    const originalName  = `Edit Test ${ts}`;
    const originalPhone = '9100000001';

    await frontdeskPage.clickAddStaff();

    // Verify Add modal opened
    await expect(frontdeskPage.getModalHeading()).toBeVisible();

    await frontdeskPage.fillStaffDetails({
      name:     originalName,
      email:    `editstaff${ts}@dermacloud.com`,
      password: 'Staff@123',
      phone:    originalPhone,
    });

    await frontdeskPage.clickSubmit();

    // Wait for Add modal to close — confirms API call completed
    await expect(frontdeskPage.getModalHeading()).not.toBeVisible({ timeout: 10000 });

    // Verify the add-success toast (briefly visible before auto-dismiss)
    await expect(frontdeskPage.getSuccessToast()).toBeVisible({ timeout: 5000 });

    // Wait for the new staff card to appear in the list
    await expect(frontdeskPage.getEditButtonForStaff(originalName)).toBeVisible({ timeout: 5000 });

    // ── Step 3: Click Edit on the newly added staff card ─────────────────────
    // getEditButtonForStaff scopes to the div.p-5 row containing the name — avoids
    // accidentally clicking Edit on a different staff member's card
    await frontdeskPage.getEditButtonForStaff(originalName).click();

    // ── Step 4: Verify the Edit modal opened ─────────────────────────────────
    // The edit modal heading is "Edit Staff" — different from the Add modal "Add Frontdesk Staff"
    await expect(frontdeskPage.getEditModalHeading()).toBeVisible();

    // ── Step 5: Assert pre-filled values ─────────────────────────────────────
    // toHaveValue() checks the <input> .value property — confirms the app loaded
    // the real DB values into the form fields before the user sees the modal.
    // WHY dedicated edit inputs? see LOCATOR STRATEGY LESSONS in the file header.
    await expect(frontdeskPage.getEditNameInput()).toHaveValue(originalName);
    await expect(frontdeskPage.getEditPhoneInput()).toHaveValue(originalPhone);

    // ── Step 6: Change the name and phone ────────────────────────────────────
    // fill() replaces the existing value entirely — no .clear() needed
    const newName  = `Edit Test ${ts} Updated`;
    const newPhone = '9100000002';

    await frontdeskPage.getEditNameInput().fill(newName);
    await frontdeskPage.getEditPhoneInput().fill(newPhone);

    // ── Step 7: Submit the edit form ─────────────────────────────────────────
    // Edit modal uses "Save Changes" button — different label from Add modal's submit
    await frontdeskPage.getSaveChangesButton().click();

    // ── Step 8: Verify "Staff updated successfully!" toast ───────────────────
    // This is a DIFFERENT toast message than the add flow ("Frontdesk staff added successfully!")
    // WHY 10000ms? the edit API can be slow — 5000ms timed out in practice even though the
    // toast did eventually appear. 10000ms gives the API enough headroom while still catching
    // the toast before it auto-dismisses (4 s display window starts when it appears, not now).
    await expect(frontdeskPage.getStaffUpdatedToast()).toBeVisible({ timeout: 20000 });

    // ── Step 9: Verify the Edit modal closed ─────────────────────────────────
    // Modal unmounts after the API call succeeds — heading disappears from DOM
    await expect(frontdeskPage.getEditModalHeading()).not.toBeVisible({ timeout: 10000 });

    // ── Step 10: Verify the staff card now shows the updated name ─────────────
    // The list re-renders after edit — getEditButtonForStaff(newName) being visible
    // confirms the card now reflects the new name from the DB
    await expect(frontdeskPage.getEditButtonForStaff(newName)).toBeVisible({ timeout: 5000 });
  });

});
