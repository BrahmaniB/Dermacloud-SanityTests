import { Page, Locator } from '@playwright/test';

// FrontdeskPage represents /clinic/settings/frontdesk
// Source: DermaCloud/app/clinic/settings/frontdesk/page.tsx
// Requires authentication

export class FrontdeskPage {

  // ─── TOP BAR ─────────────────────────────────────────────

  // Go back button — top left, button with title attribute
  // NOTE: this is a <button> not an <a> tag — unlike profile page back button
  private goBackButton: Locator;

  // Page heading and staff count subtitle
  private pageHeading:  Locator;

  // Staff count — shows "{n} staff member" or "{n} staff members"
  // We read this BEFORE and AFTER adding staff to verify count increased by 1
  private staffCountText: Locator;

  // ─── NAVIGATION BAR ──────────────────────────────────────
  // Same nav bar as dashboard and profile pages

  private navDashboard:     Locator;
  private navPatients:      Locator;
  private navConsultations: Locator;
  private navPharmacy:      Locator;
  private navTemplates:     Locator;
  private navAnalytics:     Locator;
  private navFrontdesk:     Locator;

  // ─── ADD STAFF BUTTONS ───────────────────────────────────

  // Top right button — always visible, has SVG icon
  // WHY :has(svg)? distinguishes from "Add Staff Member" button (no SVG)
  private addStaffTopButton: Locator;

  // Empty state button — only visible when NO staff exist yet
  private addStaffEmptyButton: Locator;

  // ─── ADD STAFF MODAL ─────────────────────────────────────
  // Everything inside the modal that appears after clicking Add Staff

  // Modal header elements
  private modalHeading:     Locator;
  private modalCloseButton: Locator; // X button — inside sticky header, SVG only

  // Form fields — placeholders confirmed from DOM
  private staffNameInput:     Locator;
  private staffEmailInput:    Locator;
  private staffPasswordInput: Locator;
  private staffPhoneInput:    Locator;

  // Modal action buttons
  private cancelButton: Locator;  // type="button" — closes modal without saving
  private submitButton: Locator;  // type="submit" — saves the new staff member

  // ─── STAFF CARD BUTTONS ──────────────────────────────────
  // Appear inside each existing staff card in the list
  private editButtons:       Locator;  // all Edit buttons on page
  private deactivateButtons: Locator;  // all Deactivate buttons on page

  // Empty state button — visible only when staff list is empty
  private addStaffMemberButton: Locator;

  // ─── TOAST ───────────────────────────────────────────────
  // Fixed bottom-center popup shown after save (auto-dismisses in 4s)
  // Source line 103: showToast("Frontdesk staff added successfully!", "success")
  private successToast: Locator;

  // Shown after editing an existing staff member — different message, same toast component
  private staffUpdatedToast: Locator;

  constructor(private page: Page) {

    // Top bar
    this.goBackButton   = page.locator('button[title="Go back"]');
    this.pageHeading    = page.locator('h1');
    this.staffCountText = page.locator('p.text-base.text-gray-500');

    // Navigation bar
    this.navDashboard     = page.locator('a[href="/clinic/dashboard"]');
    this.navPatients      = page.locator('a[href="/clinic/patients"]');
    this.navConsultations = page.locator('a[href="/clinic/consultations"]');
    this.navPharmacy      = page.locator('a[href="/clinic/pharmacy"]');
    this.navTemplates     = page.locator('a[href="/clinic/templates"]');
    this.navAnalytics     = page.locator('a[href="/clinic/analytics"]');
    this.navFrontdesk     = page.locator('a[href="/clinic/settings/frontdesk"]');

    // Add Staff buttons
    this.addStaffTopButton   = page.locator('button:has(svg)').filter({ hasText: 'Add Staff' });
    this.addStaffEmptyButton = page.getByRole('button', { name: 'Add Staff Member' });

    // Modal header — separate locators for Add vs Edit because the heading text differs
    this.modalHeading     = page.locator('h3').filter({ hasText: 'Add Frontdesk Staff' });
    // Close button is inside the sticky div, has no text — only SVG
    // WHY div.sticky? scopes to modal header, avoids matching other buttons
    this.modalCloseButton = page.locator('div.sticky button');

    // Modal form fields — placeholders confirmed from DOM
    this.staffNameInput     = page.getByPlaceholder('Staff member name');
    this.staffEmailInput    = page.getByPlaceholder('staff@example.com');
    this.staffPasswordInput = page.getByPlaceholder('Minimum 6 characters');
    this.staffPhoneInput    = page.getByPlaceholder('10-digit number');

    // Modal action buttons
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
    // Submit scoped to form — avoids matching top right "Add Staff" button
    this.submitButton = page.locator('form button[type="submit"]');

    // Staff card action buttons
    this.editButtons       = page.locator('button[title="Edit"]');
    this.deactivateButtons = page.locator('button[title="Deactivate"]');

    // Empty state button — only shown when no staff exist
    this.addStaffMemberButton = page.getByRole('button', { name: 'Add Staff Member' });

    // Success toast — span inside the fixed bottom popup
    this.successToast       = page.getByText('Frontdesk staff added successfully!');
    this.staffUpdatedToast  = page.getByText('Staff updated successfully!');
  }

  // ─── ACTIONS ─────────────────────────────────────────────

  async navigate() {
    await this.page.goto('/clinic/settings/frontdesk');
  }

  async clickGoBack() {
    await this.goBackButton.click();
  }

  // Navigation actions
  async goToDashboard()     { await this.navDashboard.click(); }
  async goToPatients()      { await this.navPatients.click(); }
  async goToConsultations() { await this.navConsultations.click(); }
  async goToPharmacy()      { await this.navPharmacy.click(); }
  async goToTemplates()     { await this.navTemplates.click(); }
  async goToAnalytics()     { await this.navAnalytics.click(); }

  // Add Staff button clicks
  async clickAddStaff() {
    await this.addStaffTopButton.click();
  }

  async clickAddStaffMember() {
    await this.addStaffEmptyButton.click();
  }

  // Fill all staff details in the modal
  async fillStaffDetails(data: {
    name:     string;
    email:    string;
    password: string;
    phone:    string;
  }) {
    await this.staffNameInput.fill(data.name);
    await this.staffEmailInput.fill(data.email);
    await this.staffPasswordInput.fill(data.password);
    await this.staffPhoneInput.fill(data.phone);
  }

  async closeModal() {
    await this.modalCloseButton.click();
  }

  async clickCancel() {
    await this.cancelButton.click();
  }

  async clickSubmit() {
    await this.submitButton.click();
  }

  // ─── HELPERS: Target a specific staff card by name ───────
  // Each staff row is a div.p-5 — filter by the staff name text to scope to that row
  // WHY filter? Edit/Deactivate buttons exist on EVERY row; we want the new staff's row
  getEditButtonForStaff(name: string): Locator {
    // WHY .first()? same name can exist across multiple runs (name is reused, email is unique)
    // multiple rows match hasText — .first() picks one and avoids strict mode violation
    return this.page.locator('div.p-5').filter({ hasText: name }).locator('button[title="Edit"]').first();
  }

  getDeactivateButtonForStaff(name: string): Locator {
    return this.page.locator('div.p-5').filter({ hasText: name }).locator('button[title="Deactivate"]').first();
  }

  // ─── HELPER: Wait for staff list to finish loading ───────
  // WHY needed? React shows "0 staff members" on first render before API responds
  // waitForLoadState('networkidle') misses this because the page is already idle
  // by the time we check — the useEffect fetch starts AFTER the idle window
  // Solution: wait for Edit buttons (staff loaded) OR empty-state button (no staff)
  // Either appearing means the API call completed and the DOM is up to date
  async waitForStaffList() {
    await Promise.race([
      this.editButtons.first().waitFor({ state: 'visible', timeout: 10000 }),
      this.addStaffMemberButton.waitFor({ state: 'visible', timeout: 10000 }),
    ]);
  }

  // ─── HELPER: Get current staff count as a number ─────────
  // Reads "{n} staff member(s)" text and extracts the number
  // Used to verify count increases by 1 after adding a staff member
  // Example: "2 staff members" → returns 2
  async getStaffCount(): Promise<number> {
    const text = await this.staffCountText.innerText();
    // text looks like "2 staff members" or "1 staff member"
    // parseInt extracts the first number from the string
    return parseInt(text);
  }

  // ─── GETTERS ─────────────────────────────────────────────

  getEditButtons():        Locator { return this.editButtons; }
  getDeactivateButtons():  Locator { return this.deactivateButtons; }
  getGoBackButton():       Locator { return this.goBackButton; }
  getPageHeading():        Locator { return this.pageHeading; }
  getStaffCountText():     Locator { return this.staffCountText; }
  getAddStaffTopButton():  Locator { return this.addStaffTopButton; }
  getModalHeading():       Locator { return this.modalHeading; }
  getModalCloseButton():   Locator { return this.modalCloseButton; }
  getStaffNameInput():     Locator { return this.staffNameInput; }
  getStaffEmailInput():    Locator { return this.staffEmailInput; }
  getStaffPasswordInput(): Locator { return this.staffPasswordInput; }
  getStaffPhoneInput():    Locator { return this.staffPhoneInput; }
  getCancelButton():       Locator { return this.cancelButton; }
  getSubmitButton():       Locator { return this.submitButton; }
  getSuccessToast():       Locator { return this.successToast; }
  getStaffUpdatedToast():  Locator { return this.staffUpdatedToast; }

  // ─── EDIT STAFF MODAL ────────────────────────────────────
  // Heading: "Edit Staff"  (Add modal is "Add Frontdesk Staff" — different component)
  // Submit:  "Save Changes" button (not type="submit" like the Add modal)
  //
  // DOM structure of the edit form (confirmed via DevTools):
  //   <form class="p-6 space-y-4">
  //     <div> <label>Full Name *</label>          <input type="text">  </div>
  //     <div> <label>Email (cannot change)</label> <input type="email" disabled> </div>
  //     <div> <label> </label>                     <input type="password" placeholder="Enter new password"> </div>
  //     <div> <label>Phone *</label>               <input type="tel">   </div>
  //   </form>
  //
  // Locator strategy for name/phone inputs:
  //   ✗ getByPlaceholder — no placeholder attribute on pre-filled inputs in this form
  //   ✗ getByLabel       — labels have no `for`/`id` link to their inputs; Playwright
  //                        requires explicit label–input association to use getByLabel
  //   ✓ form input[type] — each type appears once in the form; scoping to `form`
  //                        prevents matching inputs outside the modal

  getEditModalHeading(): Locator {
    return this.page.locator('h3').filter({ hasText: 'Edit Staff' });
  }

  getSaveChangesButton(): Locator {
    return this.page.getByRole('button', { name: 'Save Changes' });
  }

  getEditNameInput(): Locator {
    return this.page.locator('form input[type="text"]');
  }

  getEditPhoneInput(): Locator {
    return this.page.locator('form input[type="tel"]');
  }

}
