import { Page, Locator } from '@playwright/test';

// FormsPage represents /clinic/settings/forms
// Source: DermaCloud/app/clinic/settings/forms/page.tsx
// Requires authentication — redirects to /login if no token

export class FormsPage {

  // ─── HEADER ──────────────────────────────────────────────

  private pageHeading:      Locator;  // h1 "Form Settings"
  private headerSaveButton: Locator;  // top-right button — "Save Changes" or "Saved"

  // ─── FORM TYPE SELECTOR ──────────────────────────────────

  private dermatologyButton: Locator;  // left card button
  private cosmetologyButton: Locator;  // right card button

  // ─── SUMMARY BAR ─────────────────────────────────────────

  private unsavedChangesIndicator: Locator;  // amber badge — "Unsaved changes"

  // ─── BOTTOM SAVE BUTTON ──────────────────────────────────

  private bottomSaveButton: Locator;  // bottom button — "Save Changes" or "No Changes"

  // ─── ADD CUSTOM FIELD MODAL ──────────────────────────────

  private addFieldModalHeading:  Locator;  // h3 "Add Custom Field"
  private fieldLabelInput:       Locator;  // placeholder="e.g., Skin Texture"
  private fieldTypeSelect:       Locator;  // <select> for text/textarea
  private fieldPlaceholderInput: Locator;  // placeholder="e.g., Describe the skin texture..."
  private addFieldConfirmButton: Locator;  // "Add Field" in modal footer
  private modalErrorMessage:     Locator;  // red error box — "Field label is required."

  // ─── DELETE CONFIRM MODAL ────────────────────────────────

  private deleteConfirmRemoveButton: Locator;  // "Remove" button in confirm dialog

  constructor(private page: Page) {

    // Header
    this.pageHeading = page.locator('h1');
    // Scoped to <header> so it doesn't clash with the identical bottom save button
    // WHY filter? when hasChanges=true, BOTH header AND bottom show "Save Changes"
    // Scoping to header makes the locator unambiguous
    this.headerSaveButton = page.locator('header').getByRole('button', { name: /Save Changes|Saved/ });

    // Form type selector — the two large card buttons
    this.dermatologyButton = page.getByRole('button', { name: /Dermatology/ });
    this.cosmetologyButton = page.getByRole('button', { name: /Cosmetology/ });

    // "Unsaved changes" amber badge — only visible when hasChanges=true
    this.unsavedChangesIndicator = page.getByText('Unsaved changes');

    // Bottom save button — scoped to <main> to avoid matching header button
    // WHY /main/? both buttons say "Save Changes" when unsaved, but one is in header
    this.bottomSaveButton = page.locator('main').getByRole('button', { name: /Save Changes|No Changes/ });

    // Add Custom Field Modal
    this.addFieldModalHeading  = page.locator('h3').filter({ hasText: 'Add Custom Field' });
    this.fieldLabelInput       = page.getByPlaceholder('e.g., Skin Texture');
    this.fieldTypeSelect       = page.locator('select');
    this.fieldPlaceholderInput = page.getByPlaceholder('e.g., Describe the skin texture...');
    // "Add Field" button is only in the modal footer — unique text on this page
    this.addFieldConfirmButton = page.getByRole('button', { name: 'Add Field' });
    // Error box inside modal — only appears when label is missing
    this.modalErrorMessage     = page.locator('div.bg-red-50.border-red-200');

    // Delete confirm modal — exact: true is required here
    // WHY? getByRole name matching is substring by default, so { name: 'Remove' } also matches
    // all field-row trash buttons whose accessible name is "Remove field" (from title attribute)
    // exact: true matches only buttons whose accessible name is exactly "Remove"
    this.deleteConfirmRemoveButton = page.getByRole('button', { name: 'Remove', exact: true });
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────
  // Internal helpers that scope actions to a specific section or field row
  // Tests never call these — they call the public methods below

  // Section container — the white card wrapping a whole section (header + fields + add button)
  // WHY filter by h3? each section card has exactly one h3 with the section label text
  private getSectionContainer(sectionLabel: string): Locator {
    return this.page
      .locator('div.bg-white.rounded-2xl')
      .filter({ has: this.page.locator('h3').filter({ hasText: sectionLabel }) });
  }

  // Field row — each field is a flex div inside the section's fields list
  // WHY px-5? the row has class "flex items-center gap-3 px-5 py-3.5"
  // No other elements on the page share this exact class combination
  private getFieldRow(fieldLabel: string): Locator {
    return this.page
      .locator('div.flex.items-center.gap-3.px-5')
      .filter({ hasText: fieldLabel });
  }

  // ─── NAVIGATION ──────────────────────────────────────────

  async navigate() {
    await this.page.goto('/clinic/settings/forms');
  }

  // Wait for sections to finish loading (API call completes)
  // WHY wait for h3? the page shows a spinner while loading=true
  // Once the API responds, sections render and "Patient Information" h3 appears
  async waitForLoad() {
    await this.page
      .locator('h3')
      .filter({ hasText: 'Patient Information' })
      .waitFor({ state: 'visible', timeout: 15000 });
  }

  // Wait for Cosmetology sections to load after clicking the Cosmetology button
  // WHY a separate method? when switching form types the page re-fetches from the API
  // and sections briefly disappear (loading=true) then reappear with Cosmetology data.
  // Keeping this as its own method means we only update one place if the
  // Cosmetology form ever uses a different anchor section as the load signal.
  async waitForCosmetologyLoad() {
    await this.page
      .locator('h3')
      .filter({ hasText: 'Patient Information' })
      .waitFor({ state: 'visible', timeout: 15000 });
  }

  // ─── FORM TYPE SELECTION ─────────────────────────────────

  async selectDermatology() { await this.dermatologyButton.click(); }
  async selectCosmetology() { await this.cosmetologyButton.click(); }

  // ─── SAVE ────────────────────────────────────────────────

  async clickSaveHeader() { await this.headerSaveButton.click(); }
  async clickSaveBottom() { await this.bottomSaveButton.click(); }

  // ─── SECTION OPERATIONS (scoped by section label) ────────

  // The teal pill toggle in the section header — toggles the whole section on/off
  async clickSectionToggle(sectionLabel: string) {
    // WHY div.px-5.py-4? that's the section header row
    // WHY button.rounded-full? the toggle is a pill-shaped button
    // This scoping ensures we click the SECTION toggle, not a field toggle
    await this.getSectionContainer(sectionLabel)
      .locator('div.px-5.py-4 button.rounded-full')
      .click();
  }

  // "Add Custom Field" dashed button at the bottom of a section
  async clickAddCustomField(sectionLabel: string) {
    await this.getSectionContainer(sectionLabel)
      .getByRole('button', { name: 'Add Custom Field' })
      .click();
  }

  // ─── FIELD OPERATIONS (scoped by field label) ────────────

  // The green/gray pill toggle that enables or disables a single field
  async clickFieldToggle(fieldLabel: string) {
    // WHY button.rounded-full? same pill shape as section toggle, but in the field row
    await this.getFieldRow(fieldLabel).locator('button.rounded-full').click();
  }

  // Click the Required/Optional pill to toggle between the two states
  async clickFieldRequiredPill(fieldLabel: string) {
    await this.getFieldRequiredPill(fieldLabel).click();
  }

  // Click the trash icon to open the delete confirm modal
  async clickFieldDelete(fieldLabel: string) {
    await this.getFieldRow(fieldLabel).locator('button[title="Remove field"]').click();
  }

  // ─── ADD FIELD MODAL ACTIONS ─────────────────────────────

  async fillFieldLabel(label: string) {
    await this.fieldLabelInput.fill(label);
  }

  async selectFieldType(value: string) {
    await this.fieldTypeSelect.selectOption(value);
  }

  async fillFieldPlaceholder(placeholder: string) {
    await this.fieldPlaceholderInput.fill(placeholder);
  }

  async clickAddField() {
    await this.addFieldConfirmButton.click();
  }

  // ─── DELETE CONFIRM MODAL ACTIONS ────────────────────────

  async clickConfirmRemove() {
    await this.deleteConfirmRemoveButton.click();
  }

  // ─── GETTERS ─────────────────────────────────────────────
  // These return Locators so tests can use expect() on them

  getPageHeading():              Locator { return this.pageHeading; }
  getDermatologyButton():        Locator { return this.dermatologyButton; }
  getCosmetologyButton():        Locator { return this.cosmetologyButton; }
  getHeaderSaveButton():         Locator { return this.headerSaveButton; }
  getBottomSaveButton():         Locator { return this.bottomSaveButton; }
  getUnsavedChangesIndicator():  Locator { return this.unsavedChangesIndicator; }
  getAddFieldModalHeading():     Locator { return this.addFieldModalHeading; }
  getFieldLabelInput():          Locator { return this.fieldLabelInput; }
  getModalErrorMessage():        Locator { return this.modalErrorMessage; }

  // Section badge — the "Active" or "Hidden" pill at the right of the section header
  // WHY div.px-5.py-4 > span? the badge is a DIRECT CHILD (>) of the header row
  // using > prevents matching the inner toggle button's <span> (which is not a direct child)
  getSectionBadge(sectionLabel: string): Locator {
    return this.getSectionContainer(sectionLabel).locator('div.px-5.py-4 > span');
  }

  // Field enable toggle — for checking whether it's green (enabled) or gray (disabled)
  // Tests use toHaveClass(/bg-green-500/) or toHaveClass(/bg-gray-200/) on this
  getFieldToggle(fieldLabel: string): Locator {
    return this.getFieldRow(fieldLabel).locator('button.rounded-full');
  }

  // Required/Optional pill — for checking text AND for checking disabled attribute
  // When field is disabled: this button has HTML disabled attribute → toBeDisabled()
  getFieldRequiredPill(fieldLabel: string): Locator {
    return this.getFieldRow(fieldLabel)
      .locator('button')
      .filter({ hasText: /Required|Optional/ });
  }

  // Dynamic toast — different message per action
  // WHY getByText? the toast div contains both an SVG and the message text
  // getByText matches any element whose visible text content includes the string
  getToast(message: string): Locator {
    return this.page.getByText(message);
  }

}
