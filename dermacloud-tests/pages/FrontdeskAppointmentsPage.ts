import { Page, Locator } from '@playwright/test';

// FrontdeskAppointmentsPage represents /frontdesk/appointments
// Source: DermaCloud/app/frontdesk/appointments/page.tsx
//
// AUTH MECHANISM — localStorage (NOT cookies):
//   This page checks localStorage for frontdeskToken + frontdeskStaff on mount.
//   If missing, it redirects to /frontdesk/login.
//   Arrive here via a real UI login — storageState does not capture localStorage.
//
// KEY ASYNC BEHAVIOURS (understand before writing tests):
//   1. Patient search has a 400ms debounce — results appear after typing stops
//   2. Time slots load from /api/tier2/appointments/slots — grid appears after API responds
//   3. Success toast auto-dismisses in 4000ms — use { timeout: 10000 } to catch it

export class FrontdeskAppointmentsPage {

  // ─── HEADER ──────────────────────────────────────────────

  // h1 — "Appointments" heading in the page header bar
  private pageHeading: Locator;

  // "Book Appointment" button in the top-right header
  // WHY :has(svg)? the settings gear button is also in the header; :has(svg) alone
  // matches both, so we further filter by text to target only the booking button
  private bookAppointmentButton: Locator;

  // ─── NAV LINKS ───────────────────────────────────────────

  private navDashboard: Locator; // /frontdesk/dashboard
  private navPatients:  Locator; // /frontdesk/patients
  private navPharmacy:  Locator; // /frontdesk/pharmacy
  private navSales:     Locator; // /frontdesk/sales

  // ─── BOOKING MODAL ───────────────────────────────────────

  // h2 — "Book Appointment" heading inside the modal
  private modalHeading: Locator;

  // Patient search input — type="tel", placeholder confirmed from source line 1189
  // WHY tel type? the app uses type="tel" even though it accepts names and IDs too
  private patientSearchInput: Locator;

  // Patient results container — max-h-48 scrollable list that appears after debounce
  // Individual result buttons are scoped inside this container in selectPatient()
  private patientResultsList: Locator;

  // Date input — type="date" inside the booking form
  // WHY form-scoped? page also has a date input in the main filter area outside the modal
  private modalDateInput: Locator;

  // Time slots grid — div.grid.grid-cols-4 container holding all slot buttons
  // WHY wait on this? slots load async from /api/tier2/appointments/slots
  private timeSlotsGrid: Locator;

  // Fee input — placeholder "e.g. 500" confirmed from source line 1422
  // Accepts numeric text (the app strips non-numeric characters via onChange)
  private feeInput: Locator;

  // Confirm booking button — type="submit" inside the booking form
  // WHY form-scoped? avoids matching the main page's any other submit buttons
  private confirmBookingButton: Locator;

  // ─── TOAST ───────────────────────────────────────────────
  // Success message shown after a booking is confirmed
  // Source line 298: showToast("success", `Appointment booked for ${name} at ${time}…`)
  // WHY regex? the full text includes patient name + time which are dynamic at test time
  private successToast: Locator;

  // Toast shown after clicking "Complete" on an in-progress appointment
  // Source line 343: showToast("success", "Consultation completed")
  // WHY exact string (no regex)? this toast text is fully static — no dynamic parts
  private completedToast: Locator;

  constructor(private page: Page) {

    // Page heading — the only h1 on this page
    this.pageHeading = page.locator('h1');

    // Book Appointment button — has SVG icon and "Book Appointment" text (hidden on mobile)
    // Source line 595: <span className="hidden sm:inline text-base">Book Appointment</span>
    // WHY filter by text? there are two SVG buttons in the header (settings + book)
    this.bookAppointmentButton = page.locator('header button:has(svg)').filter({ hasText: 'Book Appointment' });

    // Nav links — located by href, consistent across all frontdesk pages
    this.navDashboard = page.locator('a[href="/frontdesk/dashboard"]');
    this.navPatients  = page.locator('a[href="/frontdesk/patients"]');
    this.navPharmacy  = page.locator('a[href="/frontdesk/pharmacy"]');
    this.navSales     = page.locator('a[href="/frontdesk/sales"]');

    // Modal heading — only present when the booking modal is open
    this.modalHeading = page.locator('h2').filter({ hasText: 'Book Appointment' });

    // Patient search input — placeholder from source line 1189
    this.patientSearchInput = page.getByPlaceholder('Search by phone number, name, or patient ID...');

    // Patient results container — appears below the search input after API responds
    // div.max-h-48 is the overflow container wrapping the result buttons (source line 1206)
    this.patientResultsList = page.locator('div.max-h-48');

    // Date input inside the modal — scoped to the form to distinguish from page date filter
    this.modalDateInput = page.locator('form input[type="date"]');

    // Time slots grid — grid-cols-4 on mobile, sm:grid-cols-5 on wider screens
    // Appears after /api/tier2/appointments/slots responds (source line 1339)
    // WHY form-scoped? the main appointments page also has a div.grid.grid-cols-4
    // (the stats cards — Scheduled/Waiting/In Consultation/Completed). Without scoping
    // to form, waitFor() passes immediately on the stats grid (always visible) and we
    // then look for slot buttons inside the wrong element — they don't exist → timeout.
    // Scoping to form guarantees we wait for the grid INSIDE the booking modal only.
    this.timeSlotsGrid = page.locator('form div.grid.grid-cols-4');

    // Fee input — placeholder from source line 1422
    this.feeInput = page.getByPlaceholder('e.g. 500');

    // Confirm booking submit button — inside the form, type="submit"
    this.confirmBookingButton = page.locator('form button[type="submit"]');

    // Success toast — regex captures "Appointment booked for" prefix before the dynamic name
    this.successToast = page.getByText(/Appointment booked for/);

    // "Consultation completed" toast — exact match because the text is fully static
    this.completedToast = page.getByText('Consultation completed');
  }

  // ─── ACTIONS ─────────────────────────────────────────────

  // Navigate directly to the frontdesk appointments page
  // NOTE: without valid localStorage this redirects to /frontdesk/login
  async navigate() {
    await this.page.goto('/frontdesk/appointments');
  }

  // Wait for the appointments page to finish loading
  async waitForLoad() {
    await this.pageHeading.waitFor({ state: 'visible', timeout: 15000 });
  }

  // Open the Book Appointment modal
  async clickBookAppointment() {
    await this.bookAppointmentButton.click();
    await this.modalHeading.waitFor({ state: 'visible', timeout: 10000 });
  }

  // Type into the patient search box — triggers 400ms debounce before results appear.
  // WHY pressSequentially instead of fill()? fill() writes directly to the DOM without
  // firing individual keystroke events. React's onChange is bound to the `input` event
  // dispatched per-keystroke. On Next.js 15 / React 18, fill() bypasses this and the
  // component's phoneQuery state never updates, so the debounce useEffect never fires.
  // pressSequentially simulates real typing — onChange fires after every character.
  async typePatientSearch(query: string) {
    await this.patientSearchInput.click();
    await this.patientSearchInput.pressSequentially(query, { delay: 80 });
  }

  // Select a patient from the results list.
  // WHY 90000ms? The full chain is: 400ms debounce → MongoDB query → React re-render.
  // GET /api/tier2/patients/list can cold-compile in 45+ seconds after the cosmetology
  // pull expanded the TypeScript graph. global-setup warms it up, but 90s is the safety
  // net for the first run after a clean .next cache.
  // WHY page-level button locator? The patient name (e.g. "E2E Patient 1777450808787")
  // is unique — no other button on the page contains it — so no false matches.
  async selectPatient(name: string) {
    const result = this.page
      .locator('button[type="button"]')
      .filter({ hasText: name })
      .first();
    await result.waitFor({ state: 'visible', timeout: 90000 });
    await result.click();
  }

  // Wait for time slots to load and click the first available slot
  // WHY wait on grid? slots load async from /api/tier2/appointments/slots
  // An available slot is a button whose text is NOT struck through (no span.line-through inside)
  async clickFirstAvailableSlot() {
    await this.timeSlotsGrid.waitFor({ state: 'visible', timeout: 45000 });
    // Available slots: button whose inner span does NOT have line-through class
    const firstAvailable = this.timeSlotsGrid
      .locator('button[type="button"]')
      .filter({ hasNot: this.page.locator('span.line-through') })
      .first();
    await firstAvailable.waitFor({ state: 'visible', timeout: 20000 });
    await firstAvailable.click();
  }

  // Fill the consultation fee field
  async fillFee(amount: string) {
    await this.feeInput.fill(amount);
  }

  // Submit the booking form and wait for the success toast
  // WHY 30000ms? POST /api/tier2/appointments writes to MongoDB. With video
  // recording running alongside a headed browser + dev server, the API can
  // take up to 20s on the first call under CPU load.
  async confirmAndWaitForToast() {
    await this.confirmBookingButton.click();
    await this.successToast.waitFor({ state: 'visible', timeout: 30000 });
  }

  // ─── NAV HELPERS ─────────────────────────────────────────

  async goToPatients()  { await this.navPatients.click(); }
  async goToDashboard() { await this.navDashboard.click(); }

  // ─── GETTERS ─────────────────────────────────────────────
  // Return locators so tests can use expect() on them directly

  getPageHeading():           Locator { return this.pageHeading; }
  getBookAppointmentButton(): Locator { return this.bookAppointmentButton; }
  getModalHeading():          Locator { return this.modalHeading; }
  getPatientSearchInput():    Locator { return this.patientSearchInput; }
  getPatientResultsList():    Locator { return this.patientResultsList; }
  getModalDateInput():        Locator { return this.modalDateInput; }
  getTimeSlotsGrid():         Locator { return this.timeSlotsGrid; }
  getFeeInput():              Locator { return this.feeInput; }
  getConfirmBookingButton():  Locator { return this.confirmBookingButton; }
  getSuccessToast():          Locator { return this.successToast; }
  getCompletedToast():        Locator { return this.completedToast; }
  getNavPatients():           Locator { return this.navPatients; }
  getNavDashboard():          Locator { return this.navDashboard; }

  // ─── QUEUE OPERATIONS ─────────────────────────────────────
  // The appointments page has two distinct UI areas:
  //   1. Booking modal   — handled by the methods above
  //   2. Queue panel     — live list of today's appointments with status controls
  //
  // Status flow managed by frontdesk:
  //   scheduled → checked-in → in-progress → completed
  //   UI labels: "Scheduled" → "Waiting" → "In Consultation" → "Completed"
  //
  // Action buttons (from source, title attributes are reliable locator targets):
  //   "Check In"  — button[title="Check in patient"]      (amber-500,   scheduled only)
  //   "Start"     — button[title="Start consultation"]    (purple-500,  checked-in only)
  //   "Complete"  — button[title="Complete consultation"] (emerald-500, in-progress only)
  //   "Dispense"  — button[title="Dispense medicines"]    (teal-500,    completed + !dispensed)

  // Returns the patient row container in the queue by patient name.
  // WHY div.group? source uses className="group p-4 sm:p-5" on each queue row.
  // WHY filter by name? patient names are timestamp-unique — no false matches.
  private getQueueRow(name: string): Locator {
    return this.page.locator('div.group').filter({ hasText: name });
  }

  // Click "Check In" for a patient — moves status: Scheduled → Waiting
  // WHY title? source uses title="Check in patient" uniquely on this button
  async clickCheckIn(name: string): Promise<void> {
    const btn = this.getQueueRow(name).locator('button[title="Check in patient"]');
    await btn.waitFor({ state: 'visible', timeout: 15000 });
    await btn.click();
  }

  // Click "Start" for a patient — moves status: Waiting → In Consultation
  // WHY title? source uses title="Start consultation" uniquely on this button
  async clickStart(name: string): Promise<void> {
    const btn = this.getQueueRow(name).locator('button[title="Start consultation"]');
    await btn.waitFor({ state: 'visible', timeout: 20000 });
    await btn.click();
  }

  // Click "Complete" for a patient — moves status: In Consultation → Completed
  // WHY 20000ms? the button only appears after the previous "Start" API write has
  // propagated and the React component re-rendered with status === "in-progress".
  // On a cold MongoDB connection this can take up to 15s.
  async clickComplete(name: string): Promise<void> {
    const btn = this.getQueueRow(name).locator('button[title="Complete consultation"]');
    await btn.waitFor({ state: 'visible', timeout: 20000 });
    await btn.click();
  }

  // Click "Dispense" for a patient — navigates away from this page to:
  //   /frontdesk/sales?action=new&patientId=...&patientName=...&appointmentId=...
  // WHY no toast wait here? the button triggers router.push() — the caller must
  // use page.waitForURL(/frontdesk\/sales/) after this call, not a toast assertion.
  async clickDispense(name: string): Promise<void> {
    const btn = this.getQueueRow(name).locator('button[title="Dispense medicines"]');
    await btn.waitFor({ state: 'visible', timeout: 20000 });
    await btn.click();
  }

  // Returns the status badge for a patient in the queue.
  // Badge labels: "Scheduled" | "Waiting" | "In Consultation" | "Completed"
  // Scoped to the patient row to avoid matching the type badge (also uses rounded-lg)
  getStatusBadge(name: string): Locator {
    return this.getQueueRow(name)
      .locator('span.rounded-lg')
      .filter({ hasText: /Scheduled|Waiting|In Consultation|Completed/ });
  }

}
