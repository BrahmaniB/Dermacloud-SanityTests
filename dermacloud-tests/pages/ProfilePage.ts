import { Page, Locator } from '@playwright/test';

// ProfilePage represents /clinic/profile
// Source: DermaCloud/app/clinic/profile/page.tsx
// Requires authentication — redirects to /login if no token in localStorage

export class ProfilePage {

  // ─── TOP BAR ────────────────────────────────────────────

  // Back arrow link — top left, title attribute makes it unique
  private backToDashboardButton: Locator;

  // Page heading and subtitle
  private profileHeading:  Locator;
  private profileSubtitle: Locator;

  // ─── NAVIGATION BAR ─────────────────────────────────────
  // Same nav bar exists on dashboard — used for way 2 to reach frontdesk
  private navDashboard:     Locator;
  private navPatients:      Locator;
  private navConsultations: Locator;
  private navPharmacy:      Locator;
  private navTemplates:     Locator;
  private navAnalytics:     Locator;
  private navFrontdesk:     Locator;

  // ─── PROFILE HEADER CONTENT ─────────────────────────────

  // Avatar circle — shows first letter of doctor name
  private avatarInitial: Locator;

  // Doctor name — h2 white text in the teal header section
  private doctorName: Locator;

  // Email shown below name in header
  private headerEmail: Locator;

  // ─── PROFILE INFO CARDS ─────────────────────────────────
  // 3 cards in a grid — email, phone, join date
  // All use same CSS class so we use nth() to distinguish them
  // nth(0) = email, nth(1) = phone, nth(2) = join date
  private emailCardValue:    Locator;
  private phoneCardValue:    Locator;
  private joinDateCardValue: Locator;

  // ─── ACTION CARDS ────────────────────────────────────────

  // Change Password button — button with h4 "Change Password" inside
  private changePasswordButton: Locator;

  // Settings links — each goes to a different settings page
  private formsLink:     Locator;
  private templatesLink: Locator;

  // Frontdesk Staff card link — way 3 to reach frontdesk page
  // WHY filter by hasText? same href exists in nav bar
  // filtering ensures we click the CARD not the nav link
  private frontdeskCardLink: Locator;

  // Logout button on profile page — full width red button at the bottom
  // WHY button.w-full? to distinguish from header logout button (no w-full)
  private logoutButton: Locator;

  constructor(private page: Page) {

    // Top bar
    this.backToDashboardButton = page.locator('a[title="Back to Dashboard"]');
    this.profileHeading        = page.locator('h1');
    this.profileSubtitle       = page.locator('p.text-gray-500').filter({ hasText: 'Account settings' });

    // Navigation bar
    this.navDashboard     = page.locator('a[href="/clinic/dashboard"]');
    this.navPatients      = page.locator('a[href="/clinic/patients"]');
    this.navConsultations = page.locator('a[href="/clinic/consultations"]');
    this.navPharmacy      = page.locator('a[href="/clinic/pharmacy"]');
    this.navTemplates     = page.locator('a[href="/clinic/templates"]');
    this.navAnalytics     = page.locator('a[href="/clinic/analytics"]');
    // WHY nav scoping? profile page has 2 links with this href
    // 1) nav bar link, 2) Frontdesk Staff card link
    // Scoping to nav ensures we only match the nav bar link
    this.navFrontdesk     = page.locator('nav a[href="/clinic/settings/frontdesk"]');

    // Profile header content
    this.avatarInitial = page.locator('span.text-white.font-bold');
    this.doctorName    = page.locator('h2.text-white');
    this.headerEmail   = page.locator('p.text-teal-100');

    // Info cards — same class, use nth() to target each one
    this.emailCardValue    = page.locator('p.text-sm.font-semibold.text-gray-900').nth(0);
    this.phoneCardValue    = page.locator('p.text-sm.font-semibold.text-gray-900').nth(1);
    this.joinDateCardValue = page.locator('p.text-sm.font-semibold.text-gray-900').nth(2);

    // Action cards
    this.changePasswordButton = page.locator('button').filter({ hasText: 'Change Password' });
    this.formsLink            = page.locator('a[href="/clinic/settings/forms"]');
    this.templatesLink        = page.locator('a[href="/clinic/templates"]');

    // Frontdesk Staff card — filtered by text to avoid matching nav bar link
    this.frontdeskCardLink = page.locator('a[href="/clinic/settings/frontdesk"]')
      .filter({ hasText: 'Frontdesk Staff' });

    // Profile page logout — w-full distinguishes it from header logout button
    this.logoutButton = page.locator('button.w-full').filter({ hasText: 'Logout' });
  }

  // ─── ACTIONS ────────────────────────────────────────────

  async navigate() {
    await this.page.goto('/clinic/profile');
  }

  async clickBackToDashboard() {
    await this.backToDashboardButton.click();
  }

  // Navigation bar actions
  async goToDashboard()     { await this.navDashboard.click(); }
  async goToPatients()      { await this.navPatients.click(); }
  async goToConsultations() { await this.navConsultations.click(); }
  async goToPharmacy()      { await this.navPharmacy.click(); }
  async goToTemplates()     { await this.navTemplates.click(); }
  async goToAnalytics()     { await this.navAnalytics.click(); }

  // Way 2: Go to frontdesk via navigation bar
  async goToFrontdeskViaNav() {
    await this.navFrontdesk.click();
  }

  // Way 3: Go to frontdesk via Frontdesk Staff card on profile page
  async goToFrontdeskViaCard() {
    await this.frontdeskCardLink.click();
  }

  async clickChangePassword() {
    await this.changePasswordButton.click();
  }

  async clickLogout() {
    await this.logoutButton.click();
  }

  async goToForms() {
    await this.formsLink.click();
  }

  // ─── GETTERS ────────────────────────────────────────────

  getBackToDashboardButton(): Locator { return this.backToDashboardButton; }
  getProfileHeading():        Locator { return this.profileHeading; }
  getProfileSubtitle():       Locator { return this.profileSubtitle; }
  getAvatarInitial():         Locator { return this.avatarInitial; }
  getDoctorName():            Locator { return this.doctorName; }
  getHeaderEmail():           Locator { return this.headerEmail; }
  getEmailCardValue():        Locator { return this.emailCardValue; }
  getPhoneCardValue():        Locator { return this.phoneCardValue; }
  getJoinDateCardValue():     Locator { return this.joinDateCardValue; }
  getChangePasswordButton():  Locator { return this.changePasswordButton; }
  getFrontdeskCardLink():     Locator { return this.frontdeskCardLink; }
  getLogoutButton():          Locator { return this.logoutButton; }
  getNavFrontdesk():          Locator { return this.navFrontdesk; }
  getNavDashboard():          Locator { return this.navDashboard; }
  getFormsLink():             Locator { return this.formsLink; }

}
