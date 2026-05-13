import { Page, Locator } from '@playwright/test';

// FrontdeskDashboardPage represents /frontdesk/dashboard
// Source: DermaCloud/app/frontdesk/dashboard/page.tsx
//
// AUTH MECHANISM — localStorage (NOT cookies):
//   This page requires frontdeskToken + frontdeskStaff in localStorage.
//   Because localStorage is not part of Playwright's storageState snapshot,
//   tests must arrive here via a real UI login — there is no shortcut file to load.

export class FrontdeskDashboardPage {

  // ─── LOCATORS ────────────────────────────────────────────

  // h1 — displays the clinic name at the top of the page
  private clinicNameHeading: Locator;

  // "Good {Morning/Afternoon/Evening}, {firstName}!" heading
  // Used as the page-load signal — this h2 only renders after the app reads
  // the staff object from localStorage and computes the greeting
  // WHY filter hasText /Good/? the page may have other h2 elements; the
  // greeting is the only h2 whose text always starts with "Good"
  private welcomeHeading: Locator;

  // Logout button — clears localStorage and redirects to /frontdesk/login
  private logoutButton: Locator;

  // ─── NAV LINKS ───────────────────────────────────────────
  // Sidebar / top-nav links — located by their href attributes
  // WHY href and not link text? nav labels may also appear as page headings;
  // scoping by href guarantees we click the nav element, not a heading

  private navDashboard:     Locator; // /frontdesk/dashboard
  private navAppointments:  Locator; // /frontdesk/appointments
  private navPatients:      Locator; // /frontdesk/patients
  private navPharmacy:      Locator; // /frontdesk/pharmacy
  private navSales:         Locator; // /frontdesk/sales

  constructor(private page: Page) {

    // Clinic name is the only h1 on the dashboard
    this.clinicNameHeading = page.locator('h1');

    // Greeting h2 — filter ensures we match the dynamic greeting even if other
    // h2 elements exist elsewhere on the page
    this.welcomeHeading = page.locator('h2').filter({ hasText: /Good/ });

    // getByRole('button') scoped to the "Logout" label — avoids matching
    // any other buttons that might appear on the page
    this.logoutButton = page.getByRole('button', { name: 'Logout' });

    // Nav links — href + exact text filter to disambiguate from "View All" links
    // on the dashboard which share the same href but appear in the content area.
    // WHY /^Appointments$/? the dashboard content has a "View All" link that also
    // points to /frontdesk/appointments — without the text filter Playwright's strict
    // mode throws "resolved to 2 elements". The ^ and $ anchors ensure exact match.
    this.navDashboard    = page.locator('a[href="/frontdesk/dashboard"]').filter({ hasText: /^Dashboard$/ });
    this.navAppointments = page.locator('a[href="/frontdesk/appointments"]').filter({ hasText: /^Appointments$/ });
    this.navPatients     = page.locator('a[href="/frontdesk/patients"]').filter({ hasText: /^Patients$/ });
    this.navPharmacy     = page.locator('a[href="/frontdesk/pharmacy"]').filter({ hasText: /^Pharmacy$/ });
    this.navSales        = page.locator('a[href="/frontdesk/sales"]').filter({ hasText: /^Sales$/ });
  }

  // ─── ACTIONS ─────────────────────────────────────────────

  // Navigate directly to the frontdesk dashboard
  // NOTE: without valid localStorage this will redirect to /frontdesk/login
  async navigate() {
    await this.page.goto('/frontdesk/dashboard');
  }

  // Wait for the page to finish loading — the welcome h2 is the load signal
  // WHY welcomeHeading? it is rendered only after the app reads the staff object
  // from localStorage, so its visibility confirms the authenticated shell is ready
  // WHY 15000ms? the greeting depends on a localStorage read + React render cycle
  // which can be slow on first load after a redirect
  async waitForLoad() {
    await this.welcomeHeading.waitFor({ state: 'visible', timeout: 15000 });
  }

  // Click the Logout button — app clears localStorage and navigates away
  async logout() {
    await this.logoutButton.click();
  }

  // ─── NAVIGATION HELPERS ──────────────────────────────────

  async goToAppointments() { await this.navAppointments.click(); }
  async goToPatients()      { await this.navPatients.click(); }
  async goToPharmacy()      { await this.navPharmacy.click(); }
  async goToSales()         { await this.navSales.click(); }

  // ─── GETTERS ─────────────────────────────────────────────
  // Return locators so tests can use expect() on them directly

  getClinicNameHeading(): Locator { return this.clinicNameHeading; }
  getWelcomeHeading():    Locator { return this.welcomeHeading; }
  getLogoutButton():      Locator { return this.logoutButton; }
  getNavDashboard():      Locator { return this.navDashboard; }
  getNavAppointments():   Locator { return this.navAppointments; }
  getNavPatients():       Locator { return this.navPatients; }
  getNavPharmacy():       Locator { return this.navPharmacy; }
  getNavSales():          Locator { return this.navSales; }

}
