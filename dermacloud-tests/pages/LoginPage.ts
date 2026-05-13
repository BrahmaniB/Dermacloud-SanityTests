import { Page, Locator } from '@playwright/test';

// LoginPage class represents the /login page of DermaCloud
// All locators and actions for this page live here
// Tests will NEVER have raw locators — only method calls

export class LoginPage {

  // ─── LOCATORS ───────────────────────────────────────────
  // We read the actual login page code to get these right
  // Source: DermaCloud/app/login/page.tsx

  private emailInput:        Locator;
  private passwordInput:     Locator;
  private signInButton:      Locator;
  private errorMessage:      Locator;
  private googleLoginButton: Locator;
  private forgotPasswordLink: Locator;
  private createAccountLink: Locator;
  private rememberMeCheckbox: Locator;
  private frontdeskLoginLink: Locator;

  constructor(private page: Page) {

    // We use getByPlaceholder because the inputs have clear placeholder text
    // This is better than CSS because placeholder text describes the field's purpose
    this.emailInput = page.getByPlaceholder('doctor@example.com');

    // Password field placeholder is "Enter your password"
    this.passwordInput = page.getByPlaceholder('Enter your password');

    // Button text is "Sign In" — we read this from the source code
    // getByRole('button') + name ensures we find a BUTTON element with that text
    // Not just any element — specifically a button
    this.signInButton = page.getByRole('button', { name: 'Sign In' });

    // Error message has no ID in the code, so we target it by its CSS class
    // 'div.text-red-700' means: a <div> that has the class text-red-700
    // We saw this class in the source code: className="...text-red-700..."
    this.errorMessage = page.locator('div.text-red-700');

    // Google button text is exactly "Continue with Google"
    this.googleLoginButton = page.getByRole('button', { name: 'Continue with Google' });

    // Links — using href attribute instead of link text
    // WHY not getByRole? 'Forgot password?' has a ? which is a special regex character
    // and can cause matching issues. href is the most reliable way to find links.
    this.forgotPasswordLink = page.locator('a[href="/forgot-password"]');
    this.createAccountLink  = page.locator('a[href="/signup"]');
    this.frontdeskLoginLink = page.locator('a[href="/frontdesk/login"]');

    // Checkbox — we find it by its label text "Remember me"
    this.rememberMeCheckbox = page.getByRole('checkbox');
  }

  // ─── ACTIONS ────────────────────────────────────────────

  // Navigate to the login page
  // baseURL is set in playwright.config.ts so /login becomes http://localhost:3000/login
  async navigate() {
    await this.page.goto('/login');
  }

  // Fill email and password, then click Sign In
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  // Just fill email (useful for testing partial form states)
  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  // Just fill password
  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  // Click Sign In without filling anything (to trigger validation)
  async clickSignIn() {
    await this.signInButton.click();
  }

  // Click the Remember Me checkbox
  async checkRememberMe() {
    await this.rememberMeCheckbox.check();
  }

  // Click Forgot Password link
  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
  }

  // Click Create an account link
  async clickCreateAccount() {
    await this.createAccountLink.click();
  }

  // Click Frontdesk Staff Login link
  async clickFrontdeskLogin() {
    await this.frontdeskLoginLink.click();
  }

  // ─── GETTERS ────────────────────────────────────────────
  // Return locators so tests can use expect() on them

  getErrorMessage():      Locator { return this.errorMessage; }
  getSignInButton():      Locator { return this.signInButton; }
  getEmailInput():        Locator { return this.emailInput; }
  getPasswordInput():     Locator { return this.passwordInput; }
  getGoogleLoginButton(): Locator { return this.googleLoginButton; }

}
