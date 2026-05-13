import { Page, Locator } from '@playwright/test';

// TemplatesPage represents /clinic/templates
// Source: DermaCloud/app/clinic/templates/page.tsx
//
// PAGE STRUCTURE:
//   Header: back button | Templates title | create buttons (changes per tab)
//   Page Tab Switcher: "Templates" tab | "Procedures" tab
//   Nav: global clinic nav links
//
//   When pageTab === "templates":
//     Header buttons: + Dermatology (teal) | + Cosmetology (purple)
//     Main: search bar | filter tabs (All / Dermatology / Cosmetology) | template cards grid
//
//   When pageTab === "procedures":
//     Header buttons: Add Procedure (purple)
//     Main: search bar | procedure cards grid (or empty state)
//
// TEMPLATE CREATE FLOW:
//   Click purple "Cosmetology" header button → modal opens (max-w-3xl)
//   Modal has: Template Name (required) | Category | Description | all cosmetology form fields
//   Clicking "Create Template" POSTs to /api/tier2/templates → success toast "Template created!"
//
// TEMPLATE DELETE FLOW:
//   Click "Delete" on a template card → confirm modal appears → click "Delete" → toast "Template deleted"
//
// PROCEDURE CREATE FLOW (new — added in pull):
//   Click "Procedures" tab in the page tab switcher
//   Click "Add Procedure" in the header → modal opens (max-w-md)
//   Modal fields: Procedure Name (required) | Category | Base Price (₹, required) | GST Rate | Description
//   Clicking "Create" POSTs to /api/tier2/cosmetology-procedures → toast "Procedure created"
//
// PROCEDURE CLEANUP:
//   Procedures have NO Delete button — only a Deactivate toggle (title="Deactivate").
//   Deactivated procedures are excluded from the autocomplete in the cosmetology visit form.
//   To deactivate: search for the procedure card → click the toggle icon (title="Deactivate").
//   Toast on success: "Procedure deactivated"

export class TemplatesPage {

  // ─── PAGE TAB SWITCHER ────────────────────────────────────
  // Two tab buttons below the header, above the main content
  private proceduresTabButton: Locator;
  private templatesTabButton: Locator;

  // ─── HEADER CREATE BUTTONS ────────────────────────────────
  // Purple "Cosmetology" button (visible only when on Templates tab)
  private cosmetologyCreateButton: Locator;

  // "Add Procedure" button (visible only when on Procedures tab)
  private addProcedureButton: Locator;

  // ─── TEMPLATE MODAL INPUTS ────────────────────────────────
  // Template Name input — required, placeholder shown when type=cosmetology
  private templateNameInput: Locator;

  // Primary concern field inside the template modal
  private primaryConcernInput: Locator;

  // "Create Template" button — the purple submit button in the template modal footer
  private createTemplateButton: Locator;

  // ─── PROCEDURE MODAL INPUTS ───────────────────────────────
  // Procedure Name text input inside the procedure modal
  // placeholder: "e.g. Chemical Peel, Laser Hair Removal"
  private procedureNameModalInput: Locator;

  // Base Price number input — first number input inside the procedure modal (max-w-md)
  // WHY scope to max-w-md? the GST rate input has identical placeholder "0";
  // scoping to the modal class isolates them. nth(0) picks base price (first column).
  private basePriceInput: Locator;

  // "Create" button — the purple submit button in the procedure modal footer
  // WHY /^Create$/? template modal has "Create Template"; this regex matches exactly "Create"
  private createProcedureButton: Locator;

  // ─── TOAST ────────────────────────────────────────────────
  // Success toast — bg-emerald-600, shown for 3.5 seconds after save/delete/deactivate
  // Matches both template messages ("Template created!", "Template deleted")
  // and procedure messages ("Procedure created", "Procedure deactivated")
  private successToast: Locator;

  // ─── SEARCH ───────────────────────────────────────────────
  // Page-level template search bar (Templates tab)
  private searchInput: Locator;

  // Procedure search bar (Procedures tab)
  private procedureSearchInput: Locator;

  constructor(private page: Page) {

    // Page tab switcher buttons
    // WHY regex /^Templates/? the badge count may append a number to the accessible name
    this.templatesTabButton  = page.getByRole('button', { name: /^Templates/ });
    this.proceduresTabButton = page.getByRole('button', { name: /^Procedures/ });

    // Purple "Cosmetology" button in the page header.
    // WHY locator('header').locator('button')?
    //   The filter tabs (All / Dermatology / Cosmetology) also have "Cosmetology" text.
    //   Scoping to <header> isolates the create buttons.
    this.cosmetologyCreateButton = page
      .locator('header')
      .locator('button')
      .filter({ hasText: 'Cosmetology' });

    // "Add Procedure" header button — only visible when pageTab === "procedures"
    this.addProcedureButton = page.getByRole('button', { name: 'Add Procedure' });

    // Template name input — unique placeholder per type
    this.templateNameInput = page.getByPlaceholder('e.g., Laser Hair Removal — First Session');

    // Primary concern — in "Patient Information" section of the template modal
    this.primaryConcernInput = page.getByPlaceholder('Main cosmetic concern (pigmentation, scars, aging, etc.)');

    // "Create Template" button — the purple submit button in the template modal footer
    this.createTemplateButton = page.getByRole('button', { name: 'Create Template' });

    // Procedure name input — in the procedure modal (max-w-md)
    this.procedureNameModalInput = page.getByPlaceholder('e.g. Chemical Peel, Laser Hair Removal');

    // Base Price — first number input inside the procedure modal.
    // The procedure modal has class max-w-md (template modal is max-w-3xl).
    // The grid inside has: col 1 = Base Price, col 2 = GST Rate — both type="number" placeholder="0".
    // nth(0) picks base price (left column).
    this.basePriceInput = page.locator('div.max-w-md input[type="number"]').nth(0);

    // "Create" button — exact regex so it doesn't match "Create Template"
    this.createProcedureButton = page.getByRole('button', { name: /^Create$/ });

    // Success toast — fixed bottom center, emerald background
    this.successToast = page.locator('div.bg-emerald-600').filter({ hasText: /Template|Procedure/ });

    // Template search bar (Templates tab)
    this.searchInput = page.getByPlaceholder('Search templates by name...');

    // Procedure search bar (Procedures tab)
    this.procedureSearchInput = page.getByPlaceholder('Search procedures...');
  }

  // ─── NAVIGATION ──────────────────────────────────────────

  async navigate(): Promise<void> {
    await this.page.goto('/clinic/templates');
  }

  // Wait for the Templates tab to finish loading.
  // Signal: template search bar visible — only rendered after the template list fetch resolves.
  async waitForLoad(): Promise<void> {
    await this.searchInput.waitFor({ state: 'visible', timeout: 20000 });
  }

  // ─── PAGE TAB SWITCHING ──────────────────────────────────

  // Switch to the Procedures tab.
  // Triggers fetchProcedures() on first visit; wait for search bar as the "done" signal.
  async clickProceduresTab(): Promise<void> {
    await this.proceduresTabButton.click();
    // The procedure search bar appears after fetchProcedures() resolves
    await this.procedureSearchInput.waitFor({ state: 'visible', timeout: 15000 });
  }

  // Switch back to the Templates tab.
  // Wait for the template search bar to confirm the tab rendered.
  async clickTemplatesTab(): Promise<void> {
    await this.templatesTabButton.click();
    await this.searchInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  // ─── TEMPLATE CREATE FLOW ────────────────────────────────

  // Click the purple "Cosmetology" header button to open the create template modal.
  async clickCreateCosmetology(): Promise<void> {
    await this.cosmetologyCreateButton.click();
    // Wait for modal to appear — template name input is unique to the modal
    await this.templateNameInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  // Fill the template name (required field).
  async fillTemplateName(name: string): Promise<void> {
    await this.templateNameInput.fill(name);
  }

  // Fill the Primary Concern field inside the template modal.
  async fillPrimaryConcern(text: string): Promise<void> {
    await this.primaryConcernInput.fill(text);
  }

  // Click "Create Template" and wait for success toast.
  async saveTemplate(): Promise<void> {
    await this.createTemplateButton.click();
    await this.successToast.waitFor({ state: 'visible', timeout: 15000 });
  }

  // ─── TEMPLATE DELETE FLOW ────────────────────────────────

  // Delete a template card by its exact name.
  async deleteTemplate(templateName: string): Promise<void> {
    // Search for the card to bring it into view
    await this.searchInput.fill(templateName);

    // Click "Delete" on the matching card
    const card = this.page.locator('div.bg-white.rounded-2xl').filter({ hasText: templateName });
    await card.getByRole('button', { name: 'Delete' }).click();

    // Confirm in the red-button confirm modal
    const confirmModal = this.page.locator('div.bg-white.rounded-2xl.shadow-2xl.max-w-sm');
    await confirmModal.waitFor({ state: 'visible', timeout: 5000 });
    await confirmModal.getByRole('button', { name: 'Delete' }).click();

    // Wait for deletion to complete
    await this.successToast.waitFor({ state: 'visible', timeout: 10000 });
  }

  // ─── PROCEDURE CREATE FLOW ───────────────────────────────

  // Click the "Add Procedure" header button to open the procedure creation modal.
  // Must already be on the Procedures tab (call clickProceduresTab() first).
  async clickAddProcedure(): Promise<void> {
    await this.addProcedureButton.click();
    // Wait for the procedure name input inside the modal to appear
    await this.procedureNameModalInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  // Fill the Procedure Name field inside the procedure modal.
  async fillProcedureNameInModal(name: string): Promise<void> {
    await this.procedureNameModalInput.fill(name);
  }

  // Fill the Base Price field inside the procedure modal.
  async fillBasePrice(price: string): Promise<void> {
    await this.basePriceInput.fill(price);
  }

  // Click "Create" in the procedure modal footer and wait for success toast.
  async saveProcedure(): Promise<void> {
    await this.createProcedureButton.click();
    await this.successToast.waitFor({ state: 'visible', timeout: 15000 });
  }

  // ─── PROCEDURE CLEANUP ───────────────────────────────────

  // Deactivate a procedure by its name.
  // Procedures have no Delete button — deactivating removes them from the
  // cosmetology visit form's autocomplete (only active procedures appear there).
  // Must already be on the Procedures tab.
  async deactivateProcedure(procedureName: string): Promise<void> {
    // Search to filter the list
    await this.procedureSearchInput.fill(procedureName);

    // Find the procedure card and click its Deactivate toggle
    // WHY [title="Deactivate"]? the button has no visible text — only an SVG icon
    const card = this.page
      .locator('div.bg-white.rounded-2xl.border')
      .filter({ hasText: procedureName });
    await card.locator('[title="Deactivate"]').click();

    // Wait for "Procedure deactivated" toast
    await this.successToast.waitFor({ state: 'visible', timeout: 10000 });
  }

  // ─── GETTERS ─────────────────────────────────────────────

  getSuccessToast():    Locator { return this.successToast; }
  getSearchInput():     Locator { return this.searchInput; }
  getCreateButton():    Locator { return this.cosmetologyCreateButton; }
}
