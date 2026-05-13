import { test, expect } from '@playwright/test';
import { FrontdeskLoginPage }        from '../pages/FrontdeskLoginPage';
import { FrontdeskDashboardPage }    from '../pages/FrontdeskDashboardPage';
import { FrontdeskPatientsPage }     from '../pages/FrontdeskPatientsPage';
import { FrontdeskAppointmentsPage } from '../pages/FrontdeskAppointmentsPage';

// ─────────────────────────────────────────────────────────────────────────────
// FILE: frontdesk-book-appointment.spec.ts
//
// WORKFLOW UNDER TEST:
//   Frontdesk staff login → dashboard validate → patients page → add patient →
//   navigate to appointments → book appointment for that patient → confirm booking
//
// PAGES TOUCHED:
//   /frontdesk/login         — real UI login (localStorage auth, not storageState)
//   /frontdesk/dashboard     — validate welcome heading after login
//   /frontdesk/patients      — add a new patient
//   /frontdesk/appointments  — book an appointment for the new patient
//
// WHY NO storageState:
//   The frontdesk portal stores auth as localStorage.frontdeskToken +
//   localStorage.frontdeskStaff. Playwright's storageState saves cookies and
//   sessionStorage only — localStorage is excluded. Every test must go through
//   the real login UI to populate these values.
//
// TEST DATA STRATEGY:
//   patient name  — "E2E Patient {timestamp}" — unique across runs
//   patient phone — "9" + last 9 digits of Date.now() — always a valid
//                   10-digit Indian mobile number and unique across runs
//   WHY timestamp? avoids "duplicate phone" API errors on repeated test runs
//
// ASYNC TIMINGS TO UNDERSTAND:
//   • Patient search in booking modal — 400ms debounce before results appear
//   • Time slots                     — async load from /api/tier2/appointments/slots
//   • All write API toasts           — use { timeout: 10000 } (POST to MongoDB is slow)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Frontdesk — Full Booking Workflow', () => {

  // WHY 90s? the workflow spans 4 pages + 2 write API calls (add patient, book appointment)
  // each write can take several seconds on a cold MongoDB connection
  test.setTimeout(90000);

  let loginPage:        FrontdeskLoginPage;
  let dashboardPage:    FrontdeskDashboardPage;
  let patientsPage:     FrontdeskPatientsPage;
  let appointmentsPage: FrontdeskAppointmentsPage;

  test.beforeEach(async ({ page }) => {
    loginPage        = new FrontdeskLoginPage(page);
    dashboardPage    = new FrontdeskDashboardPage(page);
    patientsPage     = new FrontdeskPatientsPage(page);
    appointmentsPage = new FrontdeskAppointmentsPage(page);
  });

  // ── TEST 1: Full end-to-end booking workflow ──────────────────────────────
  // Verifies the complete path a frontdesk staff member takes:
  //   login → dashboard → add patient → go to appointments → book that patient
  test(
    'Login → validate dashboard → add patient → book appointment for that patient',
    async ({ page }) => {

      // ── Step 1: Generate unique test data ──────────────────────────────────
      // WHY Date.now()? ensures no duplicate phone/name on repeated test runs
      // Phone format: "9" + 9 digits = valid 10-digit Indian mobile number
      const ts    = Date.now();
      const name  = `E2E Patient ${ts}`;
      const phone = `9${String(ts).slice(-9)}`;

      // ── Step 2: Navigate to the frontdesk login page ───────────────────────
      await loginPage.navigate();

      // ── Step 3: Login with valid credentials ──────────────────────────────
      // Credentials come from .env — never hardcoded in tests
      await loginPage.login(
        process.env.FRONTDESK_EMAIL!,
        process.env.FRONTDESK_PASSWORD!
      );

      // ── Step 4: Wait for the redirect to /frontdesk/dashboard ─────────────
      // WHY 30000ms? login API call + Next.js client-side navigation can be slow
      await page.waitForURL(/frontdesk\/dashboard/, { timeout: 30000 });

      // ── Step 5: Validate the dashboard loaded correctly ────────────────────
      // waitForLoad() waits for the greeting h2 which only renders after
      // the app reads frontdeskStaff from localStorage — confirms auth is working
      await dashboardPage.waitForLoad();
      await expect(dashboardPage.getWelcomeHeading()).toBeVisible();

      // ── Step 6: Navigate to the Patients page via nav link ─────────────────
      await dashboardPage.goToPatients();
      await page.waitForURL(/frontdesk\/patients/, { timeout: 30000 });
      await patientsPage.waitForLoad();

      // ── Step 7: Assert we are on the Patients page ─────────────────────────
      await expect(patientsPage.getPageHeading()).toHaveText('Patients');

      // ── Step 8: Open the Add Patient modal ────────────────────────────────
      await patientsPage.clickAddPatient();
      await expect(patientsPage.getModalHeading()).toBeVisible();

      // ── Step 9: Fill in the new patient details ────────────────────────────
      await patientsPage.fillNewPatient({
        name:   name,
        age:    '30',
        gender: 'female',
        phone:  phone,
      });

      // ── Step 10: Submit the form and wait for success toast ────────────────
      // Toast text: `Patient "${name}" added successfully`
      await patientsPage.submitAndWaitForToast();
      await expect(patientsPage.getSuccessToast()).toBeVisible();

      // ── Step 11: Navigate to Appointments via the nav link ─────────────────
      await patientsPage.goToAppointments();
      await page.waitForURL(/frontdesk\/appointments/, { timeout: 30000 });
      await appointmentsPage.waitForLoad();

      // ── Step 12: Assert we are on the Appointments page ───────────────────
      await expect(appointmentsPage.getPageHeading()).toHaveText('Appointments');

      // ── Step 13: Open the Book Appointment modal ──────────────────────────
      await appointmentsPage.clickBookAppointment();
      await expect(appointmentsPage.getModalHeading()).toBeVisible();

      // ── Step 14: Search for the patient we just added ─────────────────────
      // WHY search by phone? the search field accepts phone, name, and patient ID;
      // phone is the most specific identifier (unique by design from step 1)
      // The search has a 400ms debounce — selectPatient() waits for results
      await appointmentsPage.typePatientSearch(phone);

      // ── Step 15: Select the patient from the results ─────────────────────
      // selectPatient() waits up to 10000ms for the result to appear after debounce
      await appointmentsPage.selectPatient(name);

      // ── Step 16: Pick the first available time slot ───────────────────────
      // Slots load async from /api/tier2/appointments/slots
      // clickFirstAvailableSlot() waits for the grid then clicks the first
      // non-struck-through (available) slot button
      await appointmentsPage.clickFirstAvailableSlot();

      // ── Step 17: Add a consultation fee ───────────────────────────────────
      await appointmentsPage.fillFee('500');

      // ── Step 18: Confirm the booking and wait for success toast ───────────
      // Toast text: "Appointment booked for {name} at {time}" — dynamic, matched by regex
      // WHY 10000ms? POST to MongoDB — write operations can be slow
      await appointmentsPage.confirmAndWaitForToast();
      await expect(appointmentsPage.getSuccessToast()).toBeVisible();
    }
  );

});
