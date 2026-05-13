import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

// All tests for the DermaCloud login page
test.describe('DermaCloud Login Page', () => {

  let loginPage: LoginPage;

  // Before every test — create a fresh LoginPage and navigate to it
  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  // ─────────────────────────────────────────────────────────
  // GROUP 1: Page Load Tests
  // These tests check that the page loads correctly
  // They don't do any actions — just verify the UI is correct
  // ─────────────────────────────────────────────────────────

  test('login page should load and show all elements', async ({ page }) => {
    // Check page title — the browser tab title
    await expect(page).toHaveTitle(/DermaCloud|Derma/i);

    // Check URL is correct
    await expect(page).toHaveURL('/login');

    // Check all form elements are visible
    await expect(loginPage.getEmailInput()).toBeVisible();
    await expect(loginPage.getPasswordInput()).toBeVisible();
    await expect(loginPage.getSignInButton()).toBeVisible();
    await expect(loginPage.getGoogleLoginButton()).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────
  // GROUP 2: Validation Tests
  // Test what happens when user fills form incorrectly
  // Note: MongoDB may not be connected locally, so login will fail
  // But UI validation (empty fields, format checks) will still work
  // ─────────────────────────────────────────────────────────

  test('should show error for wrong credentials', async ({ page }) => {
    // Even without MongoDB, the API will respond with an error
    // This tests that the error message UI works correctly
    await loginPage.login('wrong@email.com', 'wrongpassword');

    // Wait for the error message to appear
    // WHY 15000ms? Without MongoDB connected locally, the API tries to connect
    // to the database, waits for the connection timeout, then returns an error.
    // This can take 10-15 seconds. Default timeout of 5000ms is not enough.
    await expect(loginPage.getErrorMessage()).toBeVisible({ timeout: 15000 });
  });

  test('should show error for invalid email format', async ({ page }) => {
    // HTML5 input type="email" validates format in the browser
    // Before even calling the API, the browser will show a validation message
    await loginPage.fillEmail('notanemail');
    await loginPage.clickSignIn();

    // The form should NOT submit — email input should be invalid
    // We check that we're still on the login page
    await expect(page).toHaveURL('/login');
  });

  // ─────────────────────────────────────────────────────────
  // GROUP 3: Navigation Tests
  // Test that links on the login page go to the right places
  // These don't need MongoDB — they're pure frontend navigation
  // ─────────────────────────────────────────────────────────

  test('should navigate to forgot password page', async ({ page }) => {
    await loginPage.clickForgotPassword();
    await expect(page).toHaveURL('/forgot-password');
  });

  test('should navigate to signup page', async ({ page }) => {
    await loginPage.clickCreateAccount();
    await expect(page).toHaveURL('/signup');
  });

  test('should navigate to frontdesk login page', async ({ page }) => {
    await loginPage.clickFrontdeskLogin();
    // URL should contain 'frontdesk'
    await expect(page).toHaveURL(/frontdesk/);
  });

});
