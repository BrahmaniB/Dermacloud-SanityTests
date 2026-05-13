import { test, expect } from '@playwright/test';
import * as fs   from 'fs';
import * as path from 'path';

import { LoginPage }                 from '../pages/LoginPage';
import { DashboardPage }             from '../pages/DashboardPage';
import { TemplatesPage }             from '../pages/TemplatesPage';
import { ClinicPatientPage }         from '../pages/ClinicPatientPage';
import { CosmetologyVisitPage }      from '../pages/CosmetologyVisitPage';
import { FrontdeskLoginPage }        from '../pages/FrontdeskLoginPage';
import { FrontdeskDashboardPage }    from '../pages/FrontdeskDashboardPage';
import { FrontdeskPatientsPage }     from '../pages/FrontdeskPatientsPage';
import { FrontdeskAppointmentsPage } from '../pages/FrontdeskAppointmentsPage';
import { FrontdeskSalesPage }        from '../pages/FrontdeskSalesPage';

// ─────────────────────────────────────────────────────────────────────────────
// FILE: e2e-cosmetology-consultation.spec.ts
//
// FULL WORKFLOW UNDER TEST:
//
//   [DOCTOR PORTAL — Test 0]
//     Login → Templates → Procedures tab → Add Procedure (with base price) →
//     "Procedure created" toast confirms save.
//     Then: switch to Templates tab → + Cosmetology → fill template name +
//     primaryConcern → "Create Template" → toast confirms.
//     WHY both in one test? Test 2 needs both: the procedure for autocomplete
//     and the template for the "import note" step. Creating both here ensures
//     the Templates page is only visited once before the consultation.
//
//   [FRONTDESK PORTAL — Test 1]
//     Login → Add patient → Book appointment for today →
//     Appointments queue → Check In (Scheduled → Waiting) →
//     Start (Waiting → In Consultation)
//
//   [DOCTOR PORTAL — Test 2]
//     Login → Dashboard queue "Start Visit" →
//     Patient page → Click "Cosmetology" → /clinic/visit/cosmetology →
//     Import template ("Template" button → select TEMPLATE_NAME) →
//     Type PROCEDURE_NAME in procedure autocomplete → select from dropdown →
//     Fill primary concern (required) → Upload visit photo →
//     Save & Complete Consultation → redirects to /clinic/consultation/cosmetology/{id}
//
//   [FRONTDESK PORTAL — Test 3]
//     Login → Appointments → Complete (In Consultation → Completed) →
//     Dispense → Sales modal → fill medicine → Save Sale → "Sale saved" toast
//
//   [DOCTOR PORTAL — Test 4 — Cleanup]
//     Login → Templates → delete the template created in Test 0 →
//     switch to Procedures tab → deactivate the procedure created in Test 0.
//     WHY deactivate instead of delete? procedures have no Delete button —
//     the UI only offers a Deactivate toggle. Deactivating removes the procedure
//     from the cosmetology visit autocomplete (only active procedures appear).
//     WHY a separate cleanup test? afterAll can't use a Playwright page object.
//
// WHY test.describe.serial?
//   Tests share patientName / patientPhone (set once in beforeAll) and the
//   procedure/template names. serial() guarantees order and stops the suite on failure.
//
// AUTH:
//   Tests 0, 2, 4 — Doctor:    real UI login (cookie-based clinic portal)
//   Tests 1, 3    — Frontdesk: real UI login (localStorage-based frontdesk portal)
//
// PREREQUISITES:
//   - FRONTDESK_EMAIL / FRONTDESK_PASSWORD set in .env
//   - TEST_EMAIL / TEST_PASSWORD set in .env
//   - At least one medicine in the pharmacy inventory (seeded by seed-test-db.ts: "Dolo 650")
// ─────────────────────────────────────────────────────────────────────────────

// Minimal 1×1 transparent PNG — satisfies image upload validation
const PNG_1X1_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// Procedure created in Test 0 via the Procedures tab.
// Used in Test 2 for the autocomplete selection, deactivated in Test 4.
const PROCEDURE_NAME  = 'HydraFacial Deep Cleanse';
const PROCEDURE_PRICE = '1500';

// Cosmetology template created in Test 0 via the Templates tab.
// Imported in Test 2 as the "note" import step, deleted in Test 4.
const TEMPLATE_NAME = 'HydraFacial — E2E Test Template';

test.describe.serial('Full Cosmetology Consultation E2E', () => {

  // WHY 180s? four portals × multiple API calls on a cold local MongoDB connection
  test.setTimeout(180000);

  // Shared across Tests 1 → 3 — populated in beforeAll
  let patientName:   string;
  let patientPhone:  string;
  let testImagePath: string;

  test.beforeAll(async () => {
    // Timestamp-unique test data — prevents duplicate phone errors on re-runs
    const ts  = Date.now();
    patientName  = `E2E Cosmo ${ts}`;
    patientPhone = `8${String(ts).slice(-9)}`;

    // Write a real PNG file to disk for the photo upload step.
    // WHY real file? setInputFiles() requires an actual path on disk.
    testImagePath = path.join(__dirname, '..', 'fixtures', 'test-image.png');
    fs.mkdirSync(path.dirname(testImagePath), { recursive: true });
    fs.writeFileSync(testImagePath, Buffer.from(PNG_1X1_B64, 'base64'));
  });

  // ── TEST 0: Doctor creates a procedure and a cosmetology template ──────────
  //
  // Part A — Procedures tab:
  //   Creates PROCEDURE_NAME with PROCEDURE_PRICE so the cosmetology visit form
  //   can find it via the autocomplete API (/api/tier2/cosmetology-procedures).
  //
  // Part B — Templates tab:
  //   Creates TEMPLATE_NAME so Test 2 can import it as the "note" step mid-form.
  //   The template only pre-fills primaryConcern — NOT the procedure name —
  //   so Test 2 can demonstrate the autocomplete independently.
  test(
    'Doctor: create cosmetology procedure and template',
    async ({ page }) => {

      const drLogin     = new LoginPage(page);
      const drDashboard = new DashboardPage(page);
      const templates   = new TemplatesPage(page);

      // ── Step 1: Login as doctor ────────────────────────────────────────────
      await drLogin.navigate();
      await drLogin.login(process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
      await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });

      // ── Step 2: Navigate to Templates page ────────────────────────────────
      await drDashboard.goToTemplates();
      await page.waitForURL(/clinic\/templates/, { timeout: 15000 });
      await templates.waitForLoad();

      // ── Step 3: Switch to the Procedures tab ──────────────────────────────
      // The tab switcher is below the header. Clicking "Procedures" fires
      // fetchProcedures() (first visit only). waitForProceduresLoad() waits
      // for the search bar which appears after the API call resolves.
      await templates.clickProceduresTab();

      // ── Step 4: Open the procedure creation modal ──────────────────────────
      // "Add Procedure" button appears in the header only when on Procedures tab
      await templates.clickAddProcedure();

      // ── Step 5: Fill procedure name ───────────────────────────────────────
      await templates.fillProcedureNameInModal(PROCEDURE_NAME);

      // ── Step 6: Fill base price ───────────────────────────────────────────
      // Base Price is required; the "Create" button is disabled without it
      await templates.fillBasePrice(PROCEDURE_PRICE);

      // ── Step 7: Save the procedure ────────────────────────────────────────
      // saveProcedure() internally waits for the "Procedure created" toast —
      // no extra expect needed here (double-checking causes a timing race).
      await templates.saveProcedure();

      // ── Step 8: Switch back to Templates tab ──────────────────────────────
      // We need to create a cosmetology template here for Test 2's import step
      await templates.clickTemplatesTab();

      // ── Step 9: Open the cosmetology template create modal ────────────────
      // The purple "Cosmetology" button in the header opens the modal.
      // After switch, the Dermatology/Cosmetology create buttons are visible again.
      await templates.clickCreateCosmetology();

      // ── Step 10: Fill template name ───────────────────────────────────────
      await templates.fillTemplateName(TEMPLATE_NAME);

      // ── Step 11: Fill Primary Concern ─────────────────────────────────────
      // We intentionally do NOT fill the procedure name here.
      // WHY? Test 2 demonstrates the autocomplete by typing the procedure name
      // fresh — pre-filling it in the template would skip that step.
      await templates.fillPrimaryConcern('Pigmentation and uneven skin tone');

      // ── Step 12: Save the template ────────────────────────────────────────
      // saveTemplate() internally waits for the "Template created!" toast —
      // no extra expect needed here (double-checking causes a timing race).
      await templates.saveTemplate();
    }
  );

  // ── TEST 1: Frontdesk — book appointment ──────────────────────────────────
  test(
    'Frontdesk: book appointment, check in, and start patient',
    async ({ page }) => {

      const fdLogin        = new FrontdeskLoginPage(page);
      const fdDashboard    = new FrontdeskDashboardPage(page);
      const fdPatients     = new FrontdeskPatientsPage(page);
      const fdAppointments = new FrontdeskAppointmentsPage(page);

      // ── Step 1: Login as frontdesk ────────────────────────────────────────
      await fdLogin.navigate();
      await fdLogin.login(
        process.env.FRONTDESK_EMAIL!,
        process.env.FRONTDESK_PASSWORD!
      );
      await page.waitForURL(/frontdesk\/dashboard/, { timeout: 30000 });
      await fdDashboard.waitForLoad();
      await expect(fdDashboard.getWelcomeHeading()).toBeVisible();

      // ── Step 2: Add a new patient ─────────────────────────────────────────
      await fdDashboard.goToPatients();
      await page.waitForURL(/frontdesk\/patients/, { timeout: 15000 });
      await fdPatients.waitForLoad();

      await fdPatients.clickAddPatient();
      await expect(fdPatients.getModalHeading()).toBeVisible();

      await fdPatients.fillNewPatient({
        name:   patientName,
        age:    '32',
        gender: 'female',
        phone:  patientPhone,
      });
      await fdPatients.submitAndWaitForToast();
      await expect(fdPatients.getSuccessToast()).toBeVisible();

      // ── Step 3: Book appointment for today ────────────────────────────────
      await fdPatients.goToAppointments();
      await page.waitForURL(/frontdesk\/appointments/, { timeout: 15000 });
      await fdAppointments.waitForLoad();

      await fdAppointments.clickBookAppointment();
      await expect(fdAppointments.getModalHeading()).toBeVisible();

      await fdAppointments.typePatientSearch(patientPhone);
      await fdAppointments.selectPatient(patientName);
      await fdAppointments.clickFirstAvailableSlot();
      await fdAppointments.fillFee('800');
      await fdAppointments.confirmAndWaitForToast();
      await expect(fdAppointments.getSuccessToast()).toBeVisible();

      // ── Step 4: Check in (Scheduled → Waiting) ────────────────────────────
      await fdAppointments.clickCheckIn(patientName);
      await expect(fdAppointments.getStatusBadge(patientName))
        .toHaveText('Waiting', { timeout: 30000 });

      // ── Step 5: Start (Waiting → In Consultation) ─────────────────────────
      await fdAppointments.clickStart(patientName);
      await expect(fdAppointments.getStatusBadge(patientName))
        .toHaveText('In Consultation', { timeout: 30000 });
    }
  );

  // ── TEST 2: Doctor — cosmetology consultation ─────────────────────────────
  test(
    'Doctor: start visit and complete cosmetology consultation',
    async ({ page }) => {

      const drLogin      = new LoginPage(page);
      const drDashboard  = new DashboardPage(page);
      const patientPage  = new ClinicPatientPage(page);
      const cosmoForm    = new CosmetologyVisitPage(page);

      // ── Step 1: Login as doctor ────────────────────────────────────────────
      await drLogin.navigate();
      await drLogin.login(process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
      await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });

      // ── Step 2: Start Visit from the dashboard queue ───────────────────────
      // "Start Visit" link appears for appointments in "in-progress" state.
      // Test 1 set the patient to that state.
      await drDashboard.clickStartVisit(patientName);

      // ── Step 3: Verify appointment banner on the patient page ─────────────
      await patientPage.waitForLoad();
      await patientPage.waitForAppointmentBanner();
      await expect(patientPage.getAppointmentBanner()).toBeVisible();

      // ── Step 4: Open the Cosmetology form ─────────────────────────────────
      // Navigates to /clinic/visit/cosmetology?patientId=...&appointmentId=...
      await patientPage.clickCosmetology();

      // ── Step 5: Wait for the form to render ───────────────────────────────
      // Signal: Primary Concern textarea visible (first rendered required field).
      // The form also fetches the cosmetology templates list on mount — those are
      // needed in Step 6 for the import dropdown.
      await cosmoForm.waitForFormLoad();

      // ── Step 6: Import the template (the "note" import step) ──────────────
      // Click the "Template" button in the Issue 1 header to open the dropdown.
      // Search for the template by name → select it.
      // After selection, templateData is merged into the form fields:
      //   - primaryConcern gets pre-filled from the template
      //   - procedure name field stays empty (we didn't include it in the template)
      await cosmoForm.openTemplateDropdown();
      await cosmoForm.selectTemplate(TEMPLATE_NAME);

      // ── Step 7: Fill procedure name via autocomplete ───────────────────────
      // pressSequentially() fires React's onChange on each keystroke →
      // searchProcedures() queries /api/tier2/cosmetology-procedures →
      // dropdown appears with matching active procedures.
      // Triple-click in fillProcedureName() clears any pre-existing text first.
      await cosmoForm.fillProcedureName(PROCEDURE_NAME);

      // ── Step 8: Select the procedure from the autocomplete dropdown ────────
      // The dropdown contains a button per matching procedure showing name + price.
      // Clicking it fills: name, procedureId, basePrice, gstRate, gstAmount, totalAmount.
      await cosmoForm.selectProcedureFromDropdown(PROCEDURE_NAME);

      // ── Step 9: Fill Primary Concern ──────────────────────────────────────
      // The template import in Step 6 pre-filled primaryConcern, but we fill it
      // explicitly to guarantee the required field is set regardless of template state.
      await cosmoForm.fillPrimaryConcern('Pigmentation and uneven skin tone');

      // ── Step 10: Upload a visit photo ─────────────────────────────────────
      // Injects the 1×1 PNG into the hidden file input for Issue 1.
      await cosmoForm.uploadVisitPhoto(testImagePath, 0);

      // ── Step 11: Save the consultation ────────────────────────────────────
      // Clicks "Save & Complete Consultation" → waits for navigation away from the form.
      await cosmoForm.saveConsultation();

      // Confirm the visit form URL is gone — server accepted the POST
      await expect(page).not.toHaveURL(/\/clinic\/visit\/cosmetology/);
    }
  );

  // ── TEST 3: Frontdesk — complete and dispense ─────────────────────────────
  test(
    'Frontdesk: complete consultation and dispense medicines',
    async ({ page }) => {

      const fdLogin        = new FrontdeskLoginPage(page);
      const fdDashboard    = new FrontdeskDashboardPage(page);
      const fdAppointments = new FrontdeskAppointmentsPage(page);
      const fdSales        = new FrontdeskSalesPage(page);

      // ── Step 1: Login as frontdesk ────────────────────────────────────────
      await fdLogin.navigate();
      await fdLogin.login(
        process.env.FRONTDESK_EMAIL!,
        process.env.FRONTDESK_PASSWORD!
      );
      await page.waitForURL(/frontdesk\/dashboard/, { timeout: 30000 });
      await fdDashboard.waitForLoad();

      // ── Step 2: Navigate to appointments ──────────────────────────────────
      await fdDashboard.goToAppointments();
      await page.waitForURL(/frontdesk\/appointments/, { timeout: 15000 });
      await fdAppointments.waitForLoad();

      // ── Step 3: Sanity — appointment should be "Completed" ───────────────
      // Cosmetology differs from dermatology: "Save & Complete Consultation"
      // (POST /api/tier2/consultation/cosmetology) transitions the appointment
      // directly to Completed. There is no separate Frontdesk "Complete" step.
      await expect(fdAppointments.getStatusBadge(patientName))
        .toHaveText('Completed', { timeout: 30000 });

      // ── Step 4: Dispense ──────────────────────────────────────────────────
      await fdAppointments.clickDispense(patientName);
      await page.waitForURL(/frontdesk\/sales/, { timeout: 15000 });

      // ── Step 5: Wait for modal + inventory ───────────────────────────────
      await fdSales.waitForLoad();
      await fdSales.waitForNewSaleModal();
      await fdSales.waitForInventoryLoaded();

      // ── Step 6: Fill the product name ────────────────────────────────────
      // Type the full exact inventory item name "Dolo 650" so React's onChange
      // matches it via find() and auto-fills itemId, mrp, gstRate.
      await fdSales.fillProductName(0, 'Dolo 650');

      // ── Step 7: Save the sale — waits internally for the "Sale saved" toast ──
      await fdSales.clickSaveSale();
    }
  );

  // ── TEST 4: Doctor — cleanup (delete template + deactivate procedure) ──────
  //
  // WHY a cleanup test instead of afterAll?
  //   afterAll can't use a Playwright `page` object.
  //
  // Template: can be fully deleted via the UI → "Template deleted" toast.
  // Procedure: has NO Delete button — only Deactivate.
  //   Deactivating removes it from the cosmetology visit form autocomplete
  //   (the API filters by isActive). This keeps the procedure list clean for
  //   the next test run where a new active procedure will be created.
  //
  // The global-teardown wipes Users/Clinics/FrontdeskStaff/Inventory but NOT
  // Templates or Procedures (they're stored per clinicId). This cleanup step
  // ensures the template list and active procedure list stay clean across
  // multiple manual re-runs.
  test(
    'Doctor: delete template and deactivate procedure created in Test 0',
    async ({ page }) => {

      const drLogin     = new LoginPage(page);
      const drDashboard = new DashboardPage(page);
      const templates   = new TemplatesPage(page);

      // ── Step 1: Login as doctor ────────────────────────────────────────────
      await drLogin.navigate();
      await drLogin.login(process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
      await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });

      // ── Step 2: Go to Templates ────────────────────────────────────────────
      await drDashboard.goToTemplates();
      await page.waitForURL(/clinic\/templates/, { timeout: 15000 });
      await templates.waitForLoad();

      // ── Step 3: Delete the cosmetology template ───────────────────────────
      // deleteTemplate() internally waits for the "Template deleted" toast.
      await templates.deleteTemplate(TEMPLATE_NAME);

      // ── Step 4: Switch to Procedures tab ──────────────────────────────────
      await templates.clickProceduresTab();

      // ── Step 5: Deactivate the procedure ──────────────────────────────────
      // deactivateProcedure() internally waits for the "Procedure deactivated" toast.
      await templates.deactivateProcedure(PROCEDURE_NAME);
    }
  );

});
