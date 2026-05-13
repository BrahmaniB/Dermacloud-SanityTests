import { test, expect } from '@playwright/test';
import { SignupPage } from '../pages/SignupPage';

test.describe('DermaCloud Signup Page', () => {

  let signupPage: SignupPage;

  test.beforeEach(async ({ page }) => {
    signupPage = new SignupPage(page);
    await signupPage.navigate();
  });

  // ─────────────────────────────────────────────────────────
  // GROUP 1: Page Load Tests
  // ─────────────────────────────────────────────────────────

  test('signup page should load with all fields', async ({ page }) => {
    await expect(page).toHaveURL('/signup');

    // All form fields should be visible on load
    await expect(signupPage.getNameInput()).toBeVisible();
    await expect(signupPage.getEmailInput()).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────
  // GROUP 2: Validation Tests
  // ─────────────────────────────────────────────────────────

  test('should show error when passwords do not match', async ({ page }) => {
    // Fill form with mismatched passwords
    await signupPage.fillSignupForm({
      name:            'Test Doctor',
      phone:           '9876543210',
      email:           'test@example.com',
      clinicName:      'Test Clinic',
      password:        'Password@123',
      confirmPassword: 'DifferentPassword@123', // intentionally different
    });

    await signupPage.clickCreateAccount();

    // The app code checks: if password !== confirmPassword → show error
    // Source: signup/page.tsx line 55-58
    await expect(signupPage.getErrorMessage()).toBeVisible();
    await expect(signupPage.getErrorMessage()).toContainText('Passwords do not match');
  });

  test('should show Weak strength label when password is too short', async ({ page }) => {
    // This tests real-time feedback — the strength indicator appears WHILE TYPING
    // It does NOT require clicking Create Account
    // Source: signup/page.tsx — strengthLabel shows "Weak" for strength score 1
    // The label is a <p> tag with class text-red-500 (NOT div.text-red-700)
    // WHY 'Short' not 'short'?
    // 'short' = all lowercase, < 8 chars → score 0 → label is EMPTY (no "Weak" text)
    // 'Short' = has uppercase S → score 1 → label shows "Weak" ✓
    await signupPage.fillPasswordOnly('Short');

    const strengthLabel = page.locator('p.text-red-500');
    await expect(strengthLabel).toBeVisible();
    await expect(strengthLabel).toHaveText('Weak');
  });

  test('should block form submission when password is too short', async ({ page }) => {
    // HTML input has minLength={8} — browser blocks submission before React runs
    // So we assert the page did NOT navigate — we're still on /signup
    await signupPage.fillSignupForm({
      name:            'Test Doctor',
      phone:           '9876543210',
      email:           'test@example.com',
      clinicName:      'Test Clinic',
      password:        'Short',   // uppercase gives score 1 → "Weak", still < 8 chars
      confirmPassword: 'Short',
    });

    await signupPage.clickCreateAccount();

    await expect(page).toHaveURL('/signup');
  });

  // ─────────────────────────────────────────────────────────
  // GROUP 3: Navigation Tests
  // ─────────────────────────────────────────────────────────

  test('should navigate to login page when Sign in is clicked', async ({ page }) => {
    await signupPage.clickSignIn();
    await expect(page).toHaveURL('/login');
  });

});
