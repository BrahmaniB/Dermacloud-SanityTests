import { Page, Locator } from '@playwright/test';

// SignupPage represents the /signup page of DermaCloud
// This page has 3 steps: signup form → OTP verify → plan selection
// Source: DermaCloud/app/signup/page.tsx

export class SignupPage {

  // ─── LOCATORS ───────────────────────────────────────────

  // Step 1: Signup Form
  private nameInput:            Locator;
  private phoneInput:           Locator;
  private emailInput:           Locator;
  private clinicNameInput:      Locator;
  private passwordInput:        Locator;
  private confirmPasswordInput: Locator;
  private createAccountButton:  Locator;
  private signInLink:           Locator;

  // Step 2: OTP Verification
  private otpInput:             Locator;
  private verifyButton:         Locator;

  // Error and success messages (both steps use same CSS class)
  private errorMessage:         Locator;
  private successMessage:       Locator;

  constructor(private page: Page) {

    // Step 1 locators — using placeholder text from source code
    this.nameInput            = page.getByPlaceholder('John Doe');
    this.phoneInput           = page.getByPlaceholder('9876543210');
    this.emailInput           = page.getByPlaceholder('doctor@example.com');
    this.clinicNameInput      = page.getByPlaceholder('Skin Care Clinic');
    this.passwordInput        = page.getByPlaceholder('Minimum 8 characters');
    this.confirmPasswordInput = page.getByPlaceholder('Re-enter password');

    // Button text is "Create Account" — from source code
    this.createAccountButton = page.getByRole('button', { name: 'Create Account' });

    // Link text is "Sign in"
    this.signInLink = page.getByRole('link', { name: 'Sign in' });

    // Step 2 locators
    // OTP input has placeholder "000000"
    this.otpInput     = page.getByPlaceholder('000000');
    this.verifyButton = page.getByRole('button', { name: 'Verify & Continue' });

    // Error messages are in red divs, success in green divs
    this.errorMessage   = page.locator('div.text-red-700');
    this.successMessage = page.locator('div.text-green-700');
  }

  // ─── ACTIONS ────────────────────────────────────────────

  async navigate() {
    await this.page.goto('/signup');
  }

  // Fill the entire signup form (Step 1)
  async fillSignupForm(data: {
    name: string;
    phone: string;
    email: string;
    clinicName: string;
    password: string;
    confirmPassword: string;
  }) {
    await this.nameInput.fill(data.name);
    await this.phoneInput.fill(data.phone);
    await this.emailInput.fill(data.email);
    await this.clinicNameInput.fill(data.clinicName);
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.confirmPassword);
  }

  async clickCreateAccount() {
    await this.createAccountButton.click();
  }

  async clickSignIn() {
    await this.signInLink.click();
  }

  // Fill only the password field — used to test real-time strength indicator
  async fillPasswordOnly(password: string) {
    await this.passwordInput.fill(password);
  }

  // Fill OTP (Step 2)
  async fillOTP(otp: string) {
    await this.otpInput.fill(otp);
  }

  async clickVerify() {
    await this.verifyButton.click();
  }

  // ─── GETTERS ────────────────────────────────────────────

  getErrorMessage():   Locator { return this.errorMessage; }
  getSuccessMessage(): Locator { return this.successMessage; }
  getOTPInput():       Locator { return this.otpInput; }
  getNameInput():      Locator { return this.nameInput; }
  getEmailInput():     Locator { return this.emailInput; }
}
