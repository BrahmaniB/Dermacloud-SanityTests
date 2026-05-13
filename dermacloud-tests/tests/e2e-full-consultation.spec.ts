import { test, expect } from '@playwright/test';
import * as fs   from 'fs';
import * as path from 'path';

import { FrontdeskLoginPage }        from '../pages/FrontdeskLoginPage';
import { FrontdeskDashboardPage }    from '../pages/FrontdeskDashboardPage';
import { FrontdeskPatientsPage }     from '../pages/FrontdeskPatientsPage';
import { FrontdeskAppointmentsPage } from '../pages/FrontdeskAppointmentsPage';
import { FrontdeskSalesPage }        from '../pages/FrontdeskSalesPage';
import { LoginPage }                 from '../pages/LoginPage';
import { DashboardPage }             from '../pages/DashboardPage';
import { ClinicPatientPage }         from '../pages/ClinicPatientPage';
import { DermatologyVisitPage }      from '../pages/DermatologyVisitPage';

// ─────────────────────────────────────────────────────────────────────────────
// FILE: e2e-full-consultation.spec.ts
//
// FULL WORKFLOW UNDER TEST:
//
//   [FRONTDESK PORTAL — Test 1]
//     Login → Add patient → Book appointment for today →
//     Appointments queue → Check In (Scheduled → Waiting) →
//     Start (Waiting → In Consultation)
//
//   [DOCTOR PORTAL — Test 2]
//     Login → Dashboard queue: "Start Visit" link (visible for in-progress) →
//     Patient page (amber "Appointment linked" banner) →
//     Click "Dermatology" → /clinic/visit/dermatology →
//     Fill form field → Upload clinical image → Upload dermoscope image →
//     Add medicine prescription (autocomplete) → Save Consultation
//
//   [FRONTDESK PORTAL — Test 3]
//     Login → Appointments queue → Complete (In Consultation → Completed) →
//     Dispense → /frontdesk/sales modal opens automatically →
//     Fill medicine from inventory → Save Sale → "Sale saved" toast
//
// WHY test.describe.serial?
//   Test 2 (doctor) depends on test 1 (frontdesk) having moved the patient
//   to "In Consultation". serial() guarantees order AND stops if test 1 fails
//   — no point running the doctor flow against the wrong database state.
//
// SHARED STATE:
//   patientName / patientPhone are generated once in beforeAll and read by
//   both tests. describe.serial + workers:1 ensures one JS process handles both.
//
// AUTH:
//   Test 1 — Frontdesk: real UI login (localStorage-based auth, not cookies)
//   Test 2 — Doctor:    real UI login (clinic portal, cookie-based)
//
// PREREQUISITES:
//   - FRONTDESK_EMAIL / FRONTDESK_PASSWORD set in .env
//   - TEST_EMAIL / TEST_PASSWORD set in .env
//   - At least one medicine in the pharmacy inventory (for prescription autocomplete)
//   - "Chief Complaint" field enabled in the clinic's Dermatology form config
//     (Settings → Forms → Dermatology). Adjust label in Step 5 if different.
// ─────────────────────────────────────────────────────────────────────────────

// Minimal 1×1 transparent PNG — used to satisfy image upload validation
const PNG_1X1_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test.describe.serial('Full Dermatology Consultation E2E', () => {

  // WHY 180s? two portals + add patient + book appointment + queue actions +
  // doctor login + fill form + save — each step can hit a cold MongoDB connection
  test.setTimeout(180000);

  // Shared across both tests — populated in beforeAll
  let patientName:   string;
  let patientPhone:  string;
  let testImagePath: string;

  test.beforeAll(async () => {
    // Timestamp-unique test data — prevents duplicate phone errors on re-runs
    const ts  = Date.now();
    patientName  = `E2E Consult ${ts}`;
    patientPhone = `9${String(ts).slice(-9)}`;

    // Write a real PNG file for the image upload steps.
    // WHY real file? setInputFiles() requires a path to an actual file on disk.
    // A 1×1 PNG is the smallest valid image the browser will accept.
    testImagePath = path.join(__dirname, '..', 'fixtures', 'test-image.png');
    fs.mkdirSync(path.dirname(testImagePath), { recursive: true });
    fs.writeFileSync(testImagePath, Buffer.from(PNG_1X1_B64, 'base64'));
  });

  // ── TEST 1: Frontdesk ─────────────────────────────────────────────────────
  test(
    'Frontdesk: book appointment, check in, and start patient',
    async ({ page }) => {

      const fdLogin        = new FrontdeskLoginPage(page);
      const fdDashboard    = new FrontdeskDashboardPage(page);
      const fdPatients     = new FrontdeskPatientsPage(page);
      const fdAppointments = new FrontdeskAppointmentsPage(page);

      // ── Step 1: Login as frontdesk ─────────────────────────────────────
      await fdLogin.navigate();
      await fdLogin.login(
        process.env.FRONTDESK_EMAIL!,
        process.env.FRONTDESK_PASSWORD!
      );
      await page.waitForURL(/frontdesk\/dashboard/, { timeout: 30000 });
      await fdDashboard.waitForLoad();
      await expect(fdDashboard.getWelcomeHeading()).toBeVisible();

      // ── Step 2: Add a new patient ──────────────────────────────────────
      await fdDashboard.goToPatients();
      await page.waitForURL(/frontdesk\/patients/, { timeout: 15000 });
      await fdPatients.waitForLoad();

      await fdPatients.clickAddPatient();
      await expect(fdPatients.getModalHeading()).toBeVisible();

      await fdPatients.fillNewPatient({
        name:   patientName,
        age:    '28',
        gender: 'female',
        phone:  patientPhone,
      });
      await fdPatients.submitAndWaitForToast();
      await expect(fdPatients.getSuccessToast()).toBeVisible();

      // ── Step 3: Book an appointment for today ──────────────────────────
      // Default date in the booking modal is today — no date override needed
      await fdPatients.goToAppointments();
      await page.waitForURL(/frontdesk\/appointments/, { timeout: 15000 });
      await fdAppointments.waitForLoad();

      await fdAppointments.clickBookAppointment();
      await expect(fdAppointments.getModalHeading()).toBeVisible();

      // Search by phone (unique identifier) → select the patient we just added
      await fdAppointments.typePatientSearch(patientPhone);
      await fdAppointments.selectPatient(patientName);
      await fdAppointments.clickFirstAvailableSlot();
      await fdAppointments.fillFee('500');
      await fdAppointments.confirmAndWaitForToast();
      await expect(fdAppointments.getSuccessToast()).toBeVisible();

      // ── Step 4: Check in the patient (Scheduled → Waiting) ─────────────
      // The patient card now appears in the queue below the modal controls.
      // clickCheckIn() waits up to 15s for the card to appear (API write + re-render)
      await fdAppointments.clickCheckIn(patientName);
      await expect(fdAppointments.getStatusBadge(patientName))
        .toHaveText('Waiting', { timeout: 30000 });

      // ── Step 5: Start the patient (Waiting → In Consultation) ───────────
      // This status is what the doctor dashboard uses to show "Start Visit"
      await fdAppointments.clickStart(patientName);
      await expect(fdAppointments.getStatusBadge(patientName))
        .toHaveText('In Consultation', { timeout: 30000 });
    }
  );

  // ── TEST 2: Doctor ────────────────────────────────────────────────────────
  test(
    'Doctor: start visit and complete dermatology consultation',
    async ({ page }) => {

      const drLogin     = new LoginPage(page);
      const drDashboard = new DashboardPage(page);
      const patientPage = new ClinicPatientPage(page);
      const dermaForm   = new DermatologyVisitPage(page);

      // ── Step 1: Login as doctor ────────────────────────────────────────
      await drLogin.navigate();
      await drLogin.login(
        process.env.TEST_EMAIL!,
        process.env.TEST_PASSWORD!
      );
      await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });

      // ── Step 2: Start Visit from the dashboard queue ───────────────────
      // "Start Visit" link only appears for in-progress appointments.
      // clickStartVisit() waits up to 20s for the dashboard to fetch appointments
      // then navigates to /clinic/patients/{id}?appointmentId={id}
      await drDashboard.clickStartVisit(patientName);

      // ── Step 3: Verify appointment banner on the patient page ──────────
      await patientPage.waitForLoad();
      await patientPage.waitForAppointmentBanner();
      await expect(patientPage.getAppointmentBanner()).toBeVisible();

      // ── Step 4: Open the Dermatology form ─────────────────────────────
      await patientPage.clickDermatology();
      // Arrives at /clinic/visit/dermatology?patientId=...&appointmentId=...

      // ── Step 5: Wait for the form to render ───────────────────────────
      await dermaForm.waitForFormLoad();

      // ── Step 6: Fill required form fields ────────────────────────────
      // Uses placeholder text — more reliable than getByLabel because label text
      // varies per clinic config. Fill all fields marked required (*) to pass validation.
      await dermaForm.fillFieldByPlaceholder('What is the main skin concern?', 'Itching and redness on forearm');
      await dermaForm.fillFieldByPlaceholder('How long has this been present?', '3 days');

      // ── Step 7: Upload a clinical image ───────────────────────────────
      // setInputFiles() injects the file directly — no OS file dialog involved
      await dermaForm.uploadClinicalImage(testImagePath);

      // ── Step 8: Upload a dermoscope image ─────────────────────────────
      await dermaForm.uploadDermoscopeImage(testImagePath);

      // ── Step 9: Add a prescription from the medicine list ─────────────
      // Requires at least one medicine to exist in the clinic's pharmacy inventory.
      // Type a partial name → wait for autocomplete → select first matching result.
      await dermaForm.clickAddMedicine();
      await dermaForm.typeMedicineName(0, 'Dolo');       // partial query — matches "Dolo-650" in pharmacy
      await dermaForm.selectFirstMedicineFromDropdown(); // picks first API result
      await dermaForm.fillMedicineDosage(0, '500mg');
      await dermaForm.fillMedicineFrequency(0, 'BD');
      await dermaForm.fillMedicineDuration(0, '5 days');

      // ── Step 10: Save the consultation ────────────────────────────────
      // Clicks "Save & Complete Consultation" and waits for navigation to
      // the consultation detail page (/clinic/consultation/{id})
      await dermaForm.saveConsultation();

      // Confirm we've left the visit form — save was accepted by the server
      await expect(page).not.toHaveURL(/\/clinic\/visit\/dermatology/);
    }
  );

  // ── TEST 3: Frontdesk — Complete and Dispense ─────────────────────────────
  //
  // WHY a third serial test here (not a separate file)?
  //   patientName and patientPhone are shared via beforeAll — this test needs them
  //   to find the correct row in the queue. Keeping it in the same serial describe
  //   block guarantees:
  //     1. It runs AFTER Test 2 (consultation saved, status is "In Consultation")
  //     2. It is SKIPPED automatically if Test 2 fails (no broken-state execution)
  //     3. patientName / patientPhone are in scope without any extra wiring
  //
  // AUTH: fresh frontdesk UI login — the page object is a new browser context,
  //   localStorage from Test 1 does not carry over between serial tests.
  //
  // PREREQUISITE: at least one medicine must exist in the clinic's pharmacy
  //   inventory (InventoryItem collection). The seed script does not seed inventory.
  //   Add one manually via /frontdesk/pharmacy before running, or extend
  //   seed-test-db.ts to seed an InventoryItem. The medicine partial name used
  //   below ("Dolo") must match the start of an actual inventory item name.
  test(
    'Frontdesk: complete consultation and dispense medicines',
    async ({ page }) => {

      const fdLogin        = new FrontdeskLoginPage(page);
      const fdDashboard    = new FrontdeskDashboardPage(page);
      const fdAppointments = new FrontdeskAppointmentsPage(page);
      const fdSales        = new FrontdeskSalesPage(page);

      // ── Step 1: Login as frontdesk ──────────────────────────────────────
      // WHY real login again? Playwright gives each test a fresh page — localStorage
      // (where frontdeskToken lives) is wiped between tests. Cannot reuse Test 1's auth.
      await fdLogin.navigate();
      await fdLogin.login(
        process.env.FRONTDESK_EMAIL!,
        process.env.FRONTDESK_PASSWORD!
      );
      await page.waitForURL(/frontdesk\/dashboard/, { timeout: 30000 });
      await fdDashboard.waitForLoad();

      // ── Step 2: Navigate to appointments ────────────────────────────────
      await fdDashboard.goToAppointments();
      await page.waitForURL(/frontdesk\/appointments/, { timeout: 15000 });
      await fdAppointments.waitForLoad();

      // ── Step 3: Sanity check — patient should be "In Consultation" ───────
      // Test 2 left the patient in this state (doctor saved the consultation).
      // If this assertion fails, it means Test 2 did not complete — fail fast
      // rather than clicking "Complete" on a patient in the wrong state.
      await expect(fdAppointments.getStatusBadge(patientName))
        .toHaveText('In Consultation', { timeout: 30000 });

      // ── Step 4: Complete the consultation ───────────────────────────────
      // Clicks "Complete consultation" button (emerald, in-progress rows only).
      // Triggers PUT /api/tier2/appointments/[id] with { status: "completed" }.
      // Server sets completedAt timestamp and returns the updated appointment.
      await fdAppointments.clickComplete(patientName);

      // Toast confirms the API write succeeded before we look at the badge.
      // WHY toast first, then badge? toast fires immediately on API success;
      // the badge re-renders on the next React state update — checking badge
      // first can race against the render cycle on slow machines.
      await expect(fdAppointments.getCompletedToast())
        .toBeVisible({ timeout: 15000 });

      // ── Step 5: Verify status badge changed to "Completed" ───────────────
      await expect(fdAppointments.getStatusBadge(patientName))
        .toHaveText('Completed', { timeout: 30000 });

      // ── Step 6: Click Dispense — navigate to the sales page ─────────────
      // The "Dispense medicines" button (teal) only appears when:
      //   apt.status === "completed" && canSell && !apt.dispensed
      // Clicking it calls router.push() — no toast, just a page navigation.
      // We must waitForURL() after the click, not a toast assertion.
      await fdAppointments.clickDispense(patientName);
      await page.waitForURL(/frontdesk\/sales/, { timeout: 15000 });

      // ── Step 7: Wait for modal open AND inventory datalist ready ──────────
      // waitForNewSaleModal() confirms the modal h2 has rendered.
      // waitForInventoryLoaded() polls the DOM for <option> elements inside
      // <datalist id="sale-inv-list-fds"> — these only appear after
      // fetchInvSuggestions() resolves and React renders invSuggestions.
      // WHY DOM polling instead of waitForResponse?
      //   waitForResponse starts its timeout when the Promise is created. If
      //   navigation + modal render take several seconds, the budget shrinks
      //   before the fetch even fires. DOM polling is unaffected by elapsed time.
      await fdSales.waitForLoad();
      await fdSales.waitForNewSaleModal();
      await fdSales.waitForInventoryLoaded();

      // ── Step 8: Fill the medicine name from inventory ────────────────────
      // We type the FULL exact inventory item name "Dolo 650" using pressSequentially.
      // On every keystroke the onChange handler fires and runs:
      //   invSuggestions.find(inv => inv.name.toLowerCase() === itemName.toLowerCase())
      // When the last character "0" is typed and the full name "Dolo 650" is in the
      // field, the find() returns the match → itemId, mrp, gstRate auto-fill instantly.
      // WHY not type "Dolo" + ArrowDown + Enter?
      //   Native datalist selection in Playwright Chromium does NOT reliably fire
      //   React's synthetic onChange. The browser updates the input value but React's
      //   event listener is skipped. The Product Name field stays at "Dolo" (partial),
      //   itemId stays empty, mrp stays 0 → POST /api/tier2/sales fails validation.
      //   Typing the full exact name bypasses this problem entirely — no datalist
      //   interaction needed. The match happens through onChange alone.
      await fdSales.fillProductName(0, 'Dolo 650');

      // ── Step 9: Save the sale ────────────────────────────────────────────
      // Clicks "Save Sale" (type="submit") → POST /api/tier2/sales.
      // The server creates a Sale document AND marks the appointment as dispensed
      // (the next GET /api/tier2/appointments will return dispensed: true for it).
      // clickSaveSale() waits internally for the "Sale saved — ..." toast to appear.
      await fdSales.clickSaveSale();

      // ── Step 10: Assert the success toast ───────────────────────────────
      // Toast text: "Sale saved — INV-00001" (invoice number is dynamic).
      // getSuccessToast() returns the same regex locator used internally by
      // clickSaveSale() — this redundant assertion documents the expected outcome
      // and gives Playwright one more chance to catch a flaky timing issue.
      await expect(fdSales.getSuccessToast()).toBeVisible({ timeout: 15000 });
    }
  );

});
