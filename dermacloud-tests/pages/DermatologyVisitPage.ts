import { Page, Locator } from '@playwright/test';

// DermatologyVisitPage represents /clinic/visit/dermatology
// Source: DermaCloud/app/clinic/visit/dermatology/page.tsx
//
// PAGE STRUCTURE (top → bottom):
//   1. Issue cards (default: 1 expanded issue)
//      └─ Form fields (text/textarea/select, rendered from clinic's form config)
//      └─ Clinical Images section  (file input hidden inside label)
//      └─ Dermoscope Images section (file input hidden inside label)
//   2. Prescription section — Rx cards + "+ Add Medicine" button
//   3. Sticky bottom bar   — Cancel | Save Consultation
//
// IMAGE UPLOAD STRATEGY:
//   Both file inputs are <input type="file" className="hidden"> inside <label>.
//   Clicking the label opens the OS file picker — Playwright cannot control that.
//   Use setInputFiles() directly on the hidden input to bypass the dialog.
//   Single-issue assumption: nth(0) = Clinical, nth(1) = Dermoscope.
//   Each additional issue adds 2 more inputs, so nth indexes shift accordingly.
//
// PRESCRIPTION AUTOCOMPLETE:
//   The medicine name field has an onChange handler that queries the pharmacy API.
//   Use pressSequentially (NOT fill) — fill() skips individual keystrokes so
//   React's onChange never fires and the search never triggers.
//   The dropdown (div.absolute.z-50) appears when API results return.
//
// FORM FIELD LABELS:
//   Field labels and enabled/disabled state come from the clinic's form
//   configuration (Settings → Forms → Dermatology). Use fillFieldByLabel()
//   with the exact label text visible in the UI for that clinic.

export class DermatologyVisitPage {

  // ─── SAVE / CANCEL ────────────────────────────────────────

  // Sticky bottom "Save Consultation" button — text changes to "Saving…" while posting
  private saveButton: Locator;

  // ─── IMAGE UPLOAD ─────────────────────────────────────────

  // nth(0) = hidden file input inside the Clinical Images <label>
  // nth(1) = hidden file input inside the Dermoscope Images <label>
  private clinicalImageInput:   Locator;
  private dermoscopeImageInput: Locator;

  // ─── PRESCRIPTION ─────────────────────────────────────────

  // Dashed-border button that appends a new Rx card to the prescription list
  private addMedicineButton: Locator;

  // Autocomplete dropdown — div.absolute.z-50 from source line rendering medSearchResults
  // Appears while the medicine name input has focus and results have returned from the API
  private medicineDropdown: Locator;

  constructor(private page: Page) {

    // "Save & Complete Consultation" — actual button text from source line 1832
    // WHY partial match 'Save & Complete'? robust against the conditional suffix
    // "(N issues)" appended when multiple issues exist (source line 1833)
    this.saveButton = page.locator('button').filter({ hasText: 'Save & Complete' });

    // Hidden file inputs — positional (nth) because both share type="file" accept="image/*"
    this.clinicalImageInput   = page.locator('input[type="file"]').nth(0);
    this.dermoscopeImageInput = page.locator('input[type="file"]').nth(1);

    // "+ Add Medicine" — dashed-border button in the prescription section.
    // WHY no [type="button"]? buttons without an explicit type attribute won't match
    // that selector even though they behave identically. Role + name is more robust.
    this.addMedicineButton = page.getByRole('button', { name: /Add Medicine/i });

    // Autocomplete dropdown — absolute positioned z-50 container from the source
    this.medicineDropdown = page.locator('div.absolute.z-50');
  }

  // ─── ACTIONS ─────────────────────────────────────────────

  // Wait for the form to be ready.
  // Signal: Chief Complaint textarea (placeholder "What is the main skin concern?")
  // This field is at the top of the form and is immediately in the viewport —
  // more reliable than the save button which is below the fold on a long page.
  // WHY 30000ms? the form config is fetched async after page load (clinic's
  // custom field settings). With slowMo: 800 + video recording overhead, the
  // render chain (navigate → fetch config → render fields) can exceed 15s.
  async waitForFormLoad(): Promise<void> {
    await this.page
      .getByPlaceholder('What is the main skin concern?')
      .waitFor({ state: 'visible', timeout: 30000 });
  }

  // Fill any form field by its visible label text.
  // Works for text inputs and textareas associated with a <label> element.
  // The available labels depend on the clinic's Dermatology form configuration.
  async fillFieldByLabel(label: string, text: string): Promise<void> {
    await this.page.getByLabel(label).fill(text);
  }

  // Fill any form field by its placeholder text.
  // More robust than getByLabel when the clinic's label text is unknown or varies.
  async fillFieldByPlaceholder(placeholder: string, text: string): Promise<void> {
    await this.page.getByPlaceholder(placeholder).fill(text);
  }

  // Upload a file to the Clinical Images section.
  // WHY setInputFiles not click? clicking the visible label triggers the OS file
  // picker which Playwright cannot interact with. setInputFiles() injects the
  // file directly into the hidden input, bypassing the dialog entirely.
  async uploadClinicalImage(filePath: string): Promise<void> {
    await this.clinicalImageInput.setInputFiles(filePath);
  }

  // Upload a file to the Dermoscope Images section.
  async uploadDermoscopeImage(filePath: string): Promise<void> {
    await this.dermoscopeImageInput.setInputFiles(filePath);
  }

  // Click the "+ Add Medicine" button to append a new Rx card.
  async clickAddMedicine(): Promise<void> {
    await this.addMedicineButton.click();
  }

  // Type a search query into the medicine name field for a given Rx card (0-indexed).
  // WHY pressSequentially? the input uses React's onChange to fire search queries
  // on every keystroke. fill() writes directly to the DOM without firing input events,
  // so the search never triggers. pressSequentially simulates real typing.
  async typeMedicineName(rxIndex: number, query: string): Promise<void> {
    const input = this.page
      .getByPlaceholder('e.g. Tab. Azithromycin')
      .nth(rxIndex);
    await input.click();
    await input.pressSequentially(query, { delay: 80 });
  }

  // Select a medicine from the autocomplete dropdown.
  // WHY 10000ms? the search round-trips to the pharmacy API — can be slow on cold MongoDB.
  // PREREQUISITE: at least one medicine must exist in the pharmacy inventory.
  async selectMedicineFromDropdown(medicineName: string): Promise<void> {
    await this.medicineDropdown.waitFor({ state: 'visible', timeout: 10000 });
    const option = this.medicineDropdown
      .locator('button[type="button"]')
      .filter({ hasText: medicineName })
      .first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
  }

  // Select the first result from the autocomplete dropdown regardless of name.
  // Use this when you just need any valid medicine (e.g., smoke testing the flow).
  async selectFirstMedicineFromDropdown(): Promise<void> {
    await this.medicineDropdown.waitFor({ state: 'visible', timeout: 20000 });
    await this.medicineDropdown
      .locator('button[type="button"]')
      .first()
      .click();
  }

  // Fill dosage for the Rx card at rxIndex (0-indexed).
  async fillMedicineDosage(rxIndex: number, dosage: string): Promise<void> {
    await this.page.getByPlaceholder('e.g. 500mg').nth(rxIndex).fill(dosage);
  }

  // Fill frequency for the Rx card at rxIndex (0-indexed).
  async fillMedicineFrequency(rxIndex: number, frequency: string): Promise<void> {
    await this.page.getByPlaceholder('e.g. BD, TID, OD').nth(rxIndex).fill(frequency);
  }

  // Fill duration for the Rx card at rxIndex (0-indexed).
  async fillMedicineDuration(rxIndex: number, duration: string): Promise<void> {
    await this.page.getByPlaceholder('e.g. 7 days').nth(rxIndex).fill(duration);
  }

  // Click "Save & Complete Consultation" and wait for navigation away from the form.
  // After a successful POST, the app redirects to /clinic/consultation/{id} (source line 826).
  // WHY scrollIntoViewIfNeeded? the button is at the bottom of a long form — below the
  // initial viewport. Playwright needs it in view before a reliable click.
  // WHY URL-based wait? confirms the server accepted the POST, not just a toast flash.
  async saveConsultation(): Promise<void> {
    await this.saveButton.scrollIntoViewIfNeeded();
    await this.saveButton.click();
    await this.page.waitForURL(
      url => !url.toString().includes('/clinic/visit/dermatology'),
      { timeout: 30000 }
    );
  }

  // ─── GETTERS ─────────────────────────────────────────────

  getSaveButton():         Locator { return this.saveButton; }
  getAddMedicineButton():  Locator { return this.addMedicineButton; }
  getMedicineDropdown():   Locator { return this.medicineDropdown; }

}
