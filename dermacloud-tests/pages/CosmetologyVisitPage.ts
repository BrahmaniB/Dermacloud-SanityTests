import { Page, Locator } from '@playwright/test';

// CosmetologyVisitPage represents /clinic/visit/cosmetology
// Source: DermaCloud/app/clinic/visit/cosmetology/page.tsx
//
// PAGE STRUCTURE:
//   Header (sticky): back button | "Cosmetology Visit" title | patient name/ID | nav links
//   Patient banner: patient info card
//   Issue cards (1 or 2): each has a gradient header + expanded form fields + per-issue photo upload
//   Shared sections (Follow-up): rendered below the issue cards
//   Sticky bottom bar: Cancel | Save & Complete Consultation
//
// COSMETOLOGY FORM SECTIONS (from defaultCosmetologyForm):
//   patientInfo:   skinType (select), primaryConcern (textarea, REQUIRED)
//   assessment:    findings, diagnosis, baselineEvaluation, contraindicationsCheck
//   procedure:     name, goals, sessionNumber, package, productsAndParameters, immediateOutcome
//   aftercare:     prescription, instructions, homeProducts, followUpDate, expectedResults
//   consent:       risksExplained, consentConfirmed (checkbox)
//   followUp:      date, reason  [shared — appears outside issue cards]
//
// PROCEDURE NAME AUTOCOMPLETE (added in pull):
//   When field.fieldName === "name" && field.label includes "procedure",
//   the visit page renders a custom input with onChange → searchProcedures()
//   which calls GET /api/tier2/cosmetology-procedures with a query param.
//   Results appear in a floating dropdown below the input.
//   Selecting a result auto-fills: name, procedureId, basePrice, gstRate, gstAmount, totalAmount.
//
//   WHY pressSequentially instead of fill()?
//   fill() uses Playwright's native set-value, which bypasses React's onChange handler.
//   Without onChange firing, searchProcedures() never runs → autocomplete never appears.
//   pressSequentially() simulates real keystrokes — each key fires onChange — so the
//   autocomplete triggers after every character.
//
// TEMPLATE IMPORT:
//   Each issue card header has a "Template" button.
//   Clicking it opens a dropdown with a search box and a list of cosmetology templates.
//   Selecting a template calls applyTemplateToIssue() which merges templateData into
//   the issue's formData — fields are auto-populated without a page reload.
//   After selection the button text changes to the applied template name.
//
// SAVE:
//   "Save & Complete Consultation" button at the bottom POSTs to
//   /api/tier2/consultation/cosmetology and redirects to
//   /clinic/consultation/cosmetology/{consultationId} on success.
//
// PHOTO UPLOAD:
//   Each issue card has a hidden <input type="file" multiple accept="image/*">.
//   setInputFiles() injects images directly — no OS dialog required.
//   Inputs are inside the per-issue photo section, so nth(issueIndex) selects the right one.

export class CosmetologyVisitPage {

  // ─── SAVE BUTTON ─────────────────────────────────────────
  // Sticky bottom "Save & Complete Consultation" button
  private saveButton: Locator;

  // ─── FORM FIELDS ─────────────────────────────────────────
  // Primary Concern — required, first field in patientInfo section
  private primaryConcernInput: Locator;

  // Procedure Name — in "procedure" section, fieldName: "name"
  // Has autocomplete: typing triggers searchProcedures() → floating dropdown
  // Placeholder changed in pull: was "Name of the procedure", now "Search or type procedure name..."
  private procedureNameInput: Locator;

  // ─── PROCEDURE AUTOCOMPLETE DROPDOWN ─────────────────────
  // Floating dropdown that appears below the Procedure Name input after typing.
  // Contains <button> elements, one per matching active procedure.
  // Clicking a button fills: name, procedureId, basePrice, gstRate, gstAmount, totalAmount.
  // WHY max-h-60 scoping? both procedure and medicine dropdowns share the same base classes;
  // max-h-60 is specific to procedure (medicine uses max-h-48 in prescription autocomplete...
  // wait — actually both use max-h-60 in this file). We rely on only one being open at a time.
  private procedureDropdown: Locator;

  // ─── TEMPLATE DROPDOWN ────────────────────────────────────
  // "Template" button in the issue header (Issue 1 = nth(0))
  // Text changes to the applied template name after selection
  private templateButton: Locator;

  // Search box inside the template dropdown
  private templateSearchInput: Locator;

  // ─── PHOTO UPLOAD ─────────────────────────────────────────
  // Hidden file input inside the per-issue photo section
  // nth(0) = Issue 1 photo upload, nth(1) = Issue 2 photo upload
  private visitPhotoInput: Locator;

  constructor(private page: Page) {

    this.saveButton = page.locator('button').filter({ hasText: 'Save & Complete Consultation' });

    // Primary Concern — uses placeholder from defaultCosmetologyForm
    this.primaryConcernInput = page.getByPlaceholder(
      'Main cosmetic concern (pigmentation, scars, aging, etc.)'
    );

    // Procedure Name — placeholder comes from defaultFormConfig.ts ("Name of the procedure").
    // The source renders: placeholder={field.placeholder || "Search or type procedure name..."}
    // Since field.placeholder is set in the form config, the fallback never applies.
    this.procedureNameInput = page.getByPlaceholder('Name of the procedure');

    // Procedure autocomplete dropdown — floats below the input, z-50, rounded-xl
    // Appears only while the input is focused and matching results exist
    this.procedureDropdown = page.locator(
      'div.absolute.z-50.bg-white.border.rounded-xl.shadow-lg.max-h-60'
    );

    // "Template" button in the issue header.
    // .first() targets Issue 1's button if two issue cards are ever visible.
    this.templateButton = page.getByRole('button', { name: /^Template$/i }).first();

    // Search input inside the template dropdown
    this.templateSearchInput = page.getByPlaceholder('Search by name or category…');

    // Hidden file inputs inside issue photo sections — one per issue card
    this.visitPhotoInput = page.locator('input[type="file"][accept="image/*"]');
  }

  // ─── WAIT FOR LOAD ───────────────────────────────────────

  // Wait for the form to be ready.
  // Signal: Primary Concern textarea is visible — it's the first rendered required field
  // and only appears after the async form config fetch resolves.
  // WHY 30000ms? form config is fetched on mount; slowMo + video recording on the e2e
  // project adds overhead. 15s timed out on slow CI machines in the dermatology test.
  async waitForFormLoad(): Promise<void> {
    await this.primaryConcernInput.waitFor({ state: 'visible', timeout: 30000 });
  }

  // ─── FORM ACTIONS ────────────────────────────────────────

  // Fill the Primary Concern field (required).
  async fillPrimaryConcern(text: string): Promise<void> {
    await this.primaryConcernInput.fill(text);
  }

  // Type the procedure name character by character to trigger the autocomplete dropdown.
  // Triple-clicks first to select + clear any pre-filled text (e.g., from a template import).
  // WHY pressSequentially? fill() bypasses React's onChange → searchProcedures() never fires.
  // WHY triple-click? if a template was imported before this call, the field may already
  // contain text; triple-click selects all so pressSequentially replaces it, not appends.
  async fillProcedureName(name: string): Promise<void> {
    await this.procedureNameInput.click({ clickCount: 3 }); // select-all
    await this.procedureNameInput.pressSequentially(name, { delay: 50 });
  }

  // Select a procedure from the autocomplete dropdown by its exact name.
  // Call this immediately after fillProcedureName() while the dropdown is still open.
  // WHY waitFor visible? the dropdown renders after the API call returns; clicking too
  // fast would miss the button before it is interactive.
  async selectProcedureFromDropdown(procName: string): Promise<void> {
    await this.procedureDropdown.waitFor({ state: 'visible', timeout: 10000 });
    await this.procedureDropdown
      .locator('button')
      .filter({ hasText: procName })
      .first()
      .click();
    // After selection the dropdown closes
    await this.procedureDropdown.waitFor({ state: 'hidden', timeout: 5000 });
  }

  // Fill any field by its placeholder text.
  // Covers fields from any section (findings, goals, instructions, etc.)
  async fillFieldByPlaceholder(placeholder: string, text: string): Promise<void> {
    await this.page.getByPlaceholder(placeholder).fill(text);
  }

  // ─── TEMPLATE IMPORT ─────────────────────────────────────

  // Click the "Template" button in Issue 1's header to open the dropdown.
  async openTemplateDropdown(): Promise<void> {
    await this.templateButton.click();
    // Wait for the dropdown search input to appear
    await this.templateSearchInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  // Select a template from the dropdown by its exact name.
  async selectTemplate(templateName: string): Promise<void> {
    const templateItem = this.page
      .locator('button')
      .filter({ hasText: templateName })
      .first();
    await templateItem.waitFor({ state: 'visible', timeout: 10000 });
    await templateItem.click();
    // After selection the dropdown closes — wait for it to disappear
    await this.templateSearchInput.waitFor({ state: 'hidden', timeout: 5000 });
  }

  // ─── PHOTO UPLOAD ────────────────────────────────────────

  // Upload a photo to the issue card at issueIndex (0-indexed).
  // Uses setInputFiles() to inject the file directly — no OS dialog involved.
  async uploadVisitPhoto(filePath: string, issueIndex = 0): Promise<void> {
    await this.visitPhotoInput.nth(issueIndex).setInputFiles(filePath);
  }

  // ─── SAVE ────────────────────────────────────────────────

  // Click "Save & Complete Consultation" and wait for navigation away from the form.
  // On success the app redirects to /clinic/consultation/cosmetology/{id}.
  // WHY scrollIntoViewIfNeeded? button is at the very bottom of a long form.
  async saveConsultation(): Promise<void> {
    await this.saveButton.scrollIntoViewIfNeeded();
    await this.saveButton.click();
    await this.page.waitForURL(
      url => !url.toString().includes('/clinic/visit/cosmetology'),
      { timeout: 30000 }
    );
  }

  // ─── GETTERS ─────────────────────────────────────────────

  getSaveButton():          Locator { return this.saveButton; }
  getPrimaryConerncInput(): Locator { return this.primaryConcernInput; }
  getProcedureNameInput():  Locator { return this.procedureNameInput; }
}
