import { Page, Locator } from '@playwright/test';

// FrontdeskLoginPage represents /frontdesk/login
// Source: DermaCloud/app/frontdesk/login/page.tsx
//
// AUTH MECHANISM — localStorage (NOT cookies):
//   On successful login the server returns a JWT and a staff object.
//   The app stores them as:
//     localStorage.setItem('frontdeskToken', token)
//     localStorage.setItem('frontdeskStaff', JSON.stringify(staff))
//   Because localStorage is NOT sent as a cookie, Playwright's storageState
//   (which saves/restores cookies + sessionStorage) does NOT capture it.
//   Every test that needs an authenticated session must log in through the UI.

export class FrontdeskLoginPage {

  // ─── LOCATORS ────────────────────────────────────────────

  // Email input — placeholder is the frontdesk example address shown in the form
  private emailInput: Locator;

  // Password input — shared placeholder text with the doctor login page
  private passwordInput: Locator;

  // Submit button — text is "Sign In" at rest; "Signing in..." while the API call is in flight
  // WHY getByRole? we want a BUTTON element specifically, not any element with that text
  private signInButton: Locator;

  // Error container — only rendered when the `error` state is non-empty
  // Targets the red alert box by its Tailwind background + border classes
  private errorDiv: Locator;

  // "Doctor Login" link at the bottom of the page — takes staff back to /login
  private doctorLoginLink: Locator;

  constructor(private page: Page) {

    // Frontdesk email placeholder differs from the doctor login placeholder
    // WHY getByPlaceholder? the input has no id or name — placeholder is the most
    // readable and stable hook available
    this.emailInput = page.getByPlaceholder('frontdesk@clinic.com');

    // Same placeholder text as the doctor login page — scoped to this page by navigate()
    this.passwordInput = page.getByPlaceholder('Enter your password');

    // Button text is "Sign In" — same label as the doctor login; still unambiguous
    // because this page only has one submit button
    this.signInButton = page.getByRole('button', { name: 'Sign In' });

    // Error div uses bg-red-50 + border-red-200 — only present in the DOM when
    // the component's `error` state is truthy (conditional render, not hidden)
    // WHY CSS class locator? the element has no id, role, or stable text;
    // the class combination is unique on this page
    this.errorDiv = page.locator('div.bg-red-50.border-red-200');

    // href="/login" — takes frontdesk staff to the doctor/admin login page
    // WHY not getByRole('link')? the link text may contain icons; href is reliable
    this.doctorLoginLink = page.locator('a[href="/login"]');
  }

  // ─── ACTIONS ─────────────────────────────────────────────

  // Navigate to the frontdesk login page
  // baseURL is set in playwright.config.ts — /frontdesk/login becomes http://localhost:3000/frontdesk/login
  async navigate() {
    await this.page.goto('/frontdesk/login');
  }

  // Fill email and password then submit the form
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  // ─── GETTERS ─────────────────────────────────────────────
  // Return locators so tests can use expect() on them directly

  getEmailInput():       Locator { return this.emailInput; }
  getPasswordInput():    Locator { return this.passwordInput; }
  getSignInButton():     Locator { return this.signInButton; }
  getErrorDiv():         Locator { return this.errorDiv; }
  getDoctorLoginLink():  Locator { return this.doctorLoginLink; }

}
