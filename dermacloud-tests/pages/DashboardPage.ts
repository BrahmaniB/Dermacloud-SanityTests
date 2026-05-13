import { Page, Locator } from '@playwright/test';

// DashboardPage represents /clinic/dashboard
// Source: DermaCloud/app/clinic/dashboard/page.tsx
// IMPORTANT: This page requires authentication — redirects to /login if no token

export class DashboardPage {

  // h1 tag — always shows "DermaCloud" text
  private appName: Locator;

  // <p class="text-base text-gray-500 hidden sm:block"> — shows "Dr. Test"
  // This is the doctor/clinic name shown below the h1
  private clinicName: Locator;

  // <a href="/clinic/profile"> containing a <span> with text "Profile"
  private profileLink: Locator;

  // <button> with text "Logout"
  private logoutButton: Locator;

  // ─── NAVIGATION ─────────────────────────────────────────
  private navDashboard:     Locator;
  private navPatients:      Locator;
  private navConsultations: Locator;
  private navPharmacy:      Locator;
  private navTemplates:     Locator;
  private navAnalytics:     Locator;
  private navFrontdesk:     Locator;

  constructor(private page: Page) {

    // h1 inside header — contains "DermaCloud"
    this.appName = page.locator('header h1');

    // p tag with those specific classes — contains the doctor/clinic name
    this.clinicName = page.locator('p.text-base.text-gray-500');

    // a tag with href pointing to profile page
    this.profileLink = page.locator('a[href="/clinic/profile"]');

    // button with exact text "Logout"
    this.logoutButton = page.getByRole('button', { name: 'Logout' });

    // Navigation links — all confirmed from DOM
    this.navDashboard     = page.locator('a[href="/clinic/dashboard"]');
    this.navPatients      = page.locator('a[href="/clinic/patients"]');
    this.navConsultations = page.locator('a[href="/clinic/consultations"]');
    this.navPharmacy      = page.locator('a[href="/clinic/pharmacy"]');
    this.navTemplates     = page.locator('a[href="/clinic/templates"]');
    this.navAnalytics     = page.locator('a[href="/clinic/analytics"]');
    this.navFrontdesk     = page.locator('a[href="/clinic/settings/frontdesk"]');
  }

  // ─── ACTIONS ────────────────────────────────────────────

  async navigate() {
    await this.page.goto('/clinic/dashboard');
  }

  async logout() {
    await this.logoutButton.click();
  }

  async goToProfile() {
    await this.profileLink.click();
  }

  // Navigation actions
  async goToPatients()      { await this.navPatients.click(); }
  async goToConsultations() { await this.navConsultations.click(); }
  async goToPharmacy()      { await this.navPharmacy.click(); }
  async goToTemplates()     { await this.navTemplates.click(); }
  async goToAnalytics()     { await this.navAnalytics.click(); }
  async goToFrontdesk()     { await this.navFrontdesk.click(); }

  // Click "Start Visit" in the Today's Appointments queue.
  // This link renders as <a> and is ONLY visible when a patient's appointment
  // status is "in-progress" (set by frontdesk clicking "Start" on the queue).
  // WHY 20000ms? the dashboard fetches appointments async from MongoDB — needs
  // time to load after login, especially on a cold server.
  async clickStartVisit(patientName: string): Promise<void> {
    // "Start Visit" is unique per in-progress patient — first() is a safe guard
    // patientName is accepted for documentation clarity but the link text alone
    // is specific enough since we control the test to have one in-progress patient
    const link = this.page.locator('a').filter({ hasText: 'Start Visit' }).first();
    await link.waitFor({ state: 'visible', timeout: 20000 });
    await link.click();
    await this.page.waitForURL(/\/clinic\/patients\//, { timeout: 15000 });
  }

  // ─── GETTERS ────────────────────────────────────────────

  getAppName():         Locator { return this.appName; }
  getClinicName():      Locator { return this.clinicName; }
  getProfileLink():     Locator { return this.profileLink; }
  getLogoutButton():    Locator { return this.logoutButton; }
  getNavDashboard():    Locator { return this.navDashboard; }
  getNavPatients():     Locator { return this.navPatients; }
  getNavConsultations():Locator { return this.navConsultations; }
  getNavPharmacy():     Locator { return this.navPharmacy; }
  getNavTemplates():    Locator { return this.navTemplates; }
  getNavAnalytics():    Locator { return this.navAnalytics; }
  getNavFrontdesk():    Locator { return this.navFrontdesk; }

}
