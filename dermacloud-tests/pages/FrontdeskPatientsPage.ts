import { Page, Locator } from '@playwright/test';

// FrontdeskPatientsPage represents /frontdesk/patients
// Source: DermaCloud/app/frontdesk/patients/page.tsx
//
// AUTH MECHANISM — localStorage (NOT cookies):
//   This page checks localStorage for frontdeskToken + frontdeskStaff on mount.
//   If missing, it redirects to /frontdesk/login.
//   Arrive here via a real UI login — storageState does not capture localStorage.

export class FrontdeskPatientsPage {

  // ─── HEADER ──────────────────────────────────────────────

  // h1 — "Patients" heading in the page header bar
  private pageHeading: Locator;

  // "Add Patient" button in the header (gradient teal button with SVG + text)
  // WHY :has(svg)? distinguishes from any other header buttons that lack an SVG
  private addPatientButton: Locator;

  // ─── NAV LINKS ───────────────────────────────────────────
  // The nav bar appears below the header and is shared across all frontdesk pages

  private navDashboard:    Locator; // /frontdesk/dashboard
  private navAppointments: Locator; // /frontdesk/appointments
  private navPharmacy:     Locator; // /frontdesk/pharmacy
  private navSales:        Locator; // /frontdesk/sales

  // ─── ADD PATIENT MODAL ───────────────────────────────────

  // h2 — "Add New Patient" heading inside the modal
  // WHY filter hasText? page may have other h2 elements (e.g. edit drawer heading)
  private modalHeading: Locator;

  // Full Name input — placeholder confirmed from source line 851
  private fullNameInput: Locator;

  // Age input — number type, placeholder "Age"
  private ageInput: Locator;

  // Gender selector buttons — rendered as three type="button" buttons inside a grid
  // Individually targeted by button text for clarity
  private genderMaleButton:   Locator;
  private genderFemaleButton: Locator;
  private genderOtherButton:  Locator;

  // Phone input — type="tel", placeholder confirmed from source line 915
  private phoneInput: Locator;

  // Email input (optional) — placeholder "patient@email.com"
  private emailInput: Locator;

  // "Add Patient" submit button — type="submit" inside the form
  // WHY form-scoped? prevents accidentally matching the header "Add Patient" button
  private submitButton: Locator;

  // "Cancel" button inside the modal — type="button", text "Cancel"
  // WHY getByRole? there is only one Cancel button visible when the modal is open
  private cancelButton: Locator;

  // ─── TOAST ───────────────────────────────────────────────
  // Success message shown after a patient is successfully added
  // Source line 218: showToast("success", `Patient "${newPatient.name}" added successfully`)
  // WHY regex? the name is dynamic — we match the fixed suffix text
  private successToast: Locator;

  constructor(private page: Page) {

    // Page heading — the only h1 on this page
    this.pageHeading = page.locator('h1');

    // Add Patient button — has SVG icon + "Add Patient" text
    // WHY button:has(svg)? the only button in the header with an icon
    this.addPatientButton = page.locator('header button:has(svg)').filter({ hasText: 'Add Patient' });

    // Nav links — located by href, shared with other frontdesk pages
    this.navDashboard    = page.locator('a[href="/frontdesk/dashboard"]');
    this.navAppointments = page.locator('a[href="/frontdesk/appointments"]');
    this.navPharmacy     = page.locator('a[href="/frontdesk/pharmacy"]');
    this.navSales        = page.locator('a[href="/frontdesk/sales"]');

    // Modal heading — filter prevents matching any edit drawer h2 if both are open
    this.modalHeading = page.locator('h2').filter({ hasText: 'Add New Patient' });

    // Full Name input — placeholder from source line 851
    this.fullNameInput = page.getByPlaceholder('Enter patient name');

    // Age input — placeholder from source line 866
    this.ageInput = page.getByPlaceholder('Age');

    // Gender buttons — three type="button" elements inside the gender grid
    // WHY exact: true? prevents partial-text matches if other buttons contain "Male"
    this.genderMaleButton   = page.getByRole('button', { name: 'Male',   exact: true });
    this.genderFemaleButton = page.getByRole('button', { name: 'Female', exact: true });
    this.genderOtherButton  = page.getByRole('button', { name: 'Other',  exact: true });

    // Phone input — placeholder from source line 915
    this.phoneInput = page.getByPlaceholder('10-digit phone number');

    // Email input — placeholder from source line 930
    this.emailInput = page.getByPlaceholder('patient@email.com');

    // Submit button — type="submit" scoped to the modal form
    // WHY form-scoped? the header also has a teal button; scoping to form makes it unambiguous
    this.submitButton = page.locator('form button[type="submit"]');

    // Cancel button inside the modal
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });

    // Success toast — regex matches "Patient "..." added successfully" with any name
    // WHY /added successfully/? toast text contains the dynamic patient name — regex avoids
    // needing to know the name up front, making this reusable for any patient
    this.successToast = page.getByText(/added successfully/);
  }

  // ─── ACTIONS ─────────────────────────────────────────────

  // Navigate directly to the frontdesk patients page
  // NOTE: without valid localStorage this redirects to /frontdesk/login
  async navigate() {
    await this.page.goto('/frontdesk/patients');
  }

  // Wait for the patients page to finish loading
  // The h1 "Patients" heading is the simplest load signal — it renders immediately
  async waitForLoad() {
    await this.pageHeading.waitFor({ state: 'visible', timeout: 15000 });
  }

  // Open the Add Patient modal
  async clickAddPatient() {
    await this.addPatientButton.click();
    await this.modalHeading.waitFor({ state: 'visible', timeout: 10000 });
  }

  // Fill the Add Patient form with the provided data
  async fillNewPatient(data: {
    name:   string;
    age:    string;
    gender: 'male' | 'female' | 'other';
    phone:  string;
    email?: string;
  }) {
    await this.fullNameInput.fill(data.name);
    await this.ageInput.fill(data.age);

    // Click the appropriate gender button
    if (data.gender === 'female') {
      await this.genderFemaleButton.click();
    } else if (data.gender === 'other') {
      await this.genderOtherButton.click();
    }
    // 'male' is selected by default — only click if another gender was already selected

    await this.phoneInput.fill(data.phone);

    if (data.email) {
      await this.emailInput.fill(data.email);
    }
  }

  // Submit the Add Patient form and wait for the success toast.
  // WHY 90000ms? after the cosmetology-procedures pull expanded the TS compilation
  // graph, the patients route cold-compiles in 45+ seconds on a CPU-contested machine
  // (headed browser + video recording + dev server all sharing the same core).
  // global-setup now warms up /api/tier2/patients, so subsequent runs are fast (~2s).
  // 90s is the safety net for the very first run after a clean .next cache.
  async submitAndWaitForToast() {
    await this.submitButton.click();
    await this.successToast.waitFor({ state: 'visible', timeout: 90000 });
  }

  // ─── NAV HELPERS ─────────────────────────────────────────

  async goToAppointments() { await this.navAppointments.click(); }
  async goToDashboard()    { await this.navDashboard.click(); }

  // ─── GETTERS ─────────────────────────────────────────────
  // Return locators so tests can use expect() on them directly

  getPageHeading():       Locator { return this.pageHeading; }
  getAddPatientButton():  Locator { return this.addPatientButton; }
  getModalHeading():      Locator { return this.modalHeading; }
  getFullNameInput():     Locator { return this.fullNameInput; }
  getAgeInput():          Locator { return this.ageInput; }
  getPhoneInput():        Locator { return this.phoneInput; }
  getEmailInput():        Locator { return this.emailInput; }
  getSubmitButton():      Locator { return this.submitButton; }
  getCancelButton():      Locator { return this.cancelButton; }
  getSuccessToast():      Locator { return this.successToast; }
  getGenderMaleButton():  Locator { return this.genderMaleButton; }
  getGenderFemaleButton():Locator { return this.genderFemaleButton; }
  getGenderOtherButton(): Locator { return this.genderOtherButton; }
  getNavAppointments():   Locator { return this.navAppointments; }
  getNavDashboard():      Locator { return this.navDashboard; }

}
