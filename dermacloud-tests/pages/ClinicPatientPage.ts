import { Page, Locator } from '@playwright/test';

// ClinicPatientPage represents /clinic/patients/[id]
// Source: DermaCloud/app/clinic/patients/[id]/page.tsx
//
// REACHED FROM:
//   - Dashboard "Start Visit" link → /clinic/patients/{id}?appointmentId={id}
//   - Patients list → /clinic/patients/{id}
//
// KEY BEHAVIOURS:
//   - When ?appointmentId= is in the URL, an amber banner renders:
//     "Appointment linked — start a visit below to complete this appointment"
//   - Patient data + visit history loads async from the API on mount
//   - Two "Dermatology" buttons exist:
//       1. In the header action row (always rendered once patient data loads)
//       2. In the empty-state visits section (only when visit history is empty)
//     We target the first one (.first()) — reliable regardless of visit count.

export class ClinicPatientPage {

  // ─── APPOINTMENT BANNER ──────────────────────────────────

  // Amber banner rendered when appointmentId is present in the URL.
  // Source: div.bg-amber-50 with text "Appointment linked — start a visit below…"
  private appointmentBanner: Locator;

  // ─── START VISIT BUTTONS ─────────────────────────────────

  // Link to /clinic/visit/dermatology?patientId=...&appointmentId=...
  // .first() targets the header-area button (above visit history list)
  private dermatologyLink: Locator;

  // Link to /clinic/visit/cosmetology?patientId=...&appointmentId=...
  private cosmetologyLink: Locator;

  // ─── NAV ─────────────────────────────────────────────────

  private navPatients:  Locator;
  private navDashboard: Locator;

  constructor(private page: Page) {

    // Amber banner — scoped by bg-amber-50 class + text to avoid false matches
    this.appointmentBanner = page
      .locator('div.bg-amber-50')
      .filter({ hasText: 'Appointment linked' });

    // Dermatology link — href contains /clinic/visit/dermatology
    // .first() = header action area (appears before the empty-state button)
    this.dermatologyLink = page
      .locator('a[href*="/clinic/visit/dermatology"]')
      .first();

    // Cosmetology link — included for completeness, not used in current E2E
    this.cosmetologyLink = page
      .locator('a[href*="/clinic/visit/cosmetology"]')
      .first();

    this.navPatients  = page.locator('a[href="/clinic/patients"]');
    this.navDashboard = page.locator('a[href="/clinic/dashboard"]');
  }

  // ─── ACTIONS ─────────────────────────────────────────────

  // Wait for the patient page to finish loading.
  // Signal: the Dermatology link becomes visible — only rendered after the
  // patient API response populates the action buttons.
  async waitForLoad(): Promise<void> {
    await this.dermatologyLink.waitFor({ state: 'visible', timeout: 20000 });
  }

  // Wait for the amber "Appointment linked" banner.
  // Call only when navigated here with ?appointmentId= in the URL.
  async waitForAppointmentBanner(): Promise<void> {
    await this.appointmentBanner.waitFor({ state: 'visible', timeout: 10000 });
  }

  // Click the "Dermatology" button → navigates to /clinic/visit/dermatology
  async clickDermatology(): Promise<void> {
    await this.dermatologyLink.click();
    await this.page.waitForURL(/\/clinic\/visit\/dermatology/, { timeout: 15000 });
  }

  // Click the "Cosmetology" button → navigates to /clinic/visit/cosmetology
  async clickCosmetology(): Promise<void> {
    await this.cosmetologyLink.click();
    await this.page.waitForURL(/\/clinic\/visit\/cosmetology/, { timeout: 15000 });
  }

  // ─── NAV HELPERS ─────────────────────────────────────────

  async goToPatients():  Promise<void> { await this.navPatients.click(); }
  async goToDashboard(): Promise<void> { await this.navDashboard.click(); }

  // ─── GETTERS ─────────────────────────────────────────────

  getAppointmentBanner(): Locator { return this.appointmentBanner; }
  getDermatologyLink():   Locator { return this.dermatologyLink; }
  getCosmetologyLink():   Locator { return this.cosmetologyLink; }

}
