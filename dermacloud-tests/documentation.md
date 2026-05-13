# DermaCloud Test Framework — Documentation

## What This Is

A Playwright + TypeScript test framework built using the **Page Object Model (POM)** pattern
to test the DermaCloud web application (Next.js 15, running locally at `http://localhost:3000`).

Built from scratch by learning Playwright coming from a Selenium Java background.

---

## Prerequisites

Before running any tests:

1. **Node.js** must be installed
2. **DermaCloud app** must be running locally at `http://localhost:3000`
3. **MongoDB** must be connected (the app reads/writes real data)
4. **`.env` file** must exist at `dermacloud-tests/.env` with these values:

```
TEST_EMAIL=your-clinic-email@example.com
TEST_PASSWORD=YourPassword
TEST_CLINIC_NAME=Your Clinic Name
FRONTDESK_EMAIL=your-frontdesk-staff-email
FRONTDESK_PASSWORD=YourFrontdeskPassword
```

---

## Folder Structure

```
dermacloud-tests/
├── pages/                        — Page Object classes (one per page)
│   ├── LoginPage.ts
│   ├── SignupPage.ts
│   ├── DashboardPage.ts
│   ├── ProfilePage.ts
│   ├── FormsPage.ts              — NEW: /clinic/settings/forms
│   ├── FrontdeskPage.ts
│   ├── FrontdeskLoginPage.ts        — /frontdesk/login (frontdesk staff portal)
│   ├── FrontdeskDashboardPage.ts    — /frontdesk/dashboard (frontdesk staff portal)
│   ├── FrontdeskPatientsPage.ts     — NEW: /frontdesk/patients
│   └── FrontdeskAppointmentsPage.ts — NEW: /frontdesk/appointments
├── tests/                        — Test spec files
│   ├── logout.spec.ts            — 5 logout tests (all passing)
│   ├── forms.spec.ts             — 7 Dermatology form settings tests (all passing)
│   ├── cosmetology-forms.spec.ts — 7 Cosmetology form settings tests (all passing)
│   ├── frontdesk.spec.ts         — 3 Add Staff tests via 3 navigation paths (all passing)
│   ├── frontdesk-edit.spec.ts    — 1 Edit Staff test: pre-fill, change, toast (all passing)
│   ├── frontdesk-portal-login.spec.ts — 3 frontdesk login/logout tests (all passing)
│   ├── frontdesk-book-appointment.spec.ts — NEW: full booking workflow (all passing)
│   └── dashboard.spec.ts
├── playwright/
│   └── .auth/
│       └── user.json             — Saved auth token (auto-created, git-ignored)
├── global-setup.ts               — NEW: logs in once before all tests run
├── playwright.config.ts          — Global Playwright configuration
├── .env                          — Credentials (never commit this file)
├── pending.md                    — Tests planned but not yet written (replaces pending.txt)
├── documentation.md              — This file
└── learning.md                   — Learning journal (concepts + bugs explained)
```

---

## How to Run Tests

```bash
# Run all tests
npx playwright test

# Run a specific file
npx playwright test logout.spec.ts
npx playwright test forms.spec.ts

# Run with browser visible (headed mode — good for debugging)
npx playwright test forms.spec.ts --headed

# Run with one-line output per test (cleaner terminal view)
npx playwright test forms.spec.ts --reporter=list

# Open the interactive HTML report after a run
npx playwright show-report
```

---

## playwright.config.ts — Key Settings

| Setting | Value | Why |
|---|---|---|
| `globalSetup` | `./global-setup` | Logs in once before ALL tests — saves auth token to file |
| `baseURL` | `http://localhost:3000` | Write `page.goto('/login')` instead of full URL everywhere |
| `workers` | `1` | Tests hit real MongoDB — parallel runs cause race conditions |
| `retries` | `0` local / `2` CI | No retries locally so failures are visible immediately |
| `headless` | `true` | Runs without opening browser (use `--headed` flag to watch) |
| `actionTimeout` | `30000ms` | How long to wait for clicks/fills before failing |
| `navigationTimeout` | `30000ms` | How long to wait for page navigation before failing |
| `reporter` | `html` | Generates a visual report — open with `npx playwright show-report` |

---

## global-setup.ts

This file runs **once before any test starts** (configured via `globalSetup` in `playwright.config.ts`).

**What it does:**
1. Opens a real browser
2. Goes to `/login`, fills credentials from `.env`, clicks Sign In
3. Waits for the dashboard URL — confirms login worked
4. Saves the entire browser storage (localStorage with the auth token) to `playwright/.auth/user.json`
5. Closes the browser

**Why it exists:**
The DermaCloud login API has a **rate limiter**. If too many login requests arrive in a short time it blocks further attempts with *"Too many login attempts. Please try again later."* With 7 form tests each doing a full UI login, tests 4–7 all timed out. The fix: login once globally, share the token with every test.

---

## Page Objects

### What is a Page Object?

A TypeScript class that represents one page of the app. It holds:
- **Locators** — how to find elements on that page
- **Actions** — methods like `login()`, `clickSaveHeader()` that the tests call
- **Getters** — methods that return locators so tests can assert on them

This way, if the UI changes, you only fix the locator in **ONE place** instead of every test.

---

### LoginPage.ts — `/login`

| Locator | Element | How found |
|---|---|---|
| `emailInput` | Email field | `getByPlaceholder('doctor@example.com')` |
| `passwordInput` | Password field | `getByPlaceholder('Enter your password')` |
| `signInButton` | Sign In button | `getByRole('button', { name: 'Sign In' })` |
| `errorMessage` | Red error box | `locator('div.text-red-700')` |
| `forgotPasswordLink` | Forgot Password link | `locator('a[href="/forgot-password"]')` |
| `createAccountLink` | Go to Signup link | `locator('a[href="/signup"]')` |

**Key methods:** `navigate()`, `login(email, password)`

**Lesson learned:** `getByRole('link', { name: 'Forgot Password?' })` failed because
the `?` broke the regex. Fixed by using the `href` attribute directly instead.

---

### DashboardPage.ts — `/clinic/dashboard`

| Locator | Element | How found |
|---|---|---|
| `appName` | "DermaCloud" heading | `header h1` |
| `clinicName` | Clinic name text | `p.text-base.text-gray-500` |
| `profileLink` | Profile link in header | `a[href="/clinic/profile"]` |
| `logoutButton` | Logout button | `getByRole('button', { name: 'Logout' })` |
| `navFrontdesk` | Frontdesk nav link | `a[href="/clinic/settings/frontdesk"]` |

**Key methods:** `navigate()`, `goToProfile()`, `logout()`

---

### ProfilePage.ts — `/clinic/profile`

| Locator | Element | How found |
|---|---|---|
| `profileHeading` | "Profile" h1 | `locator('h1')` |
| `doctorName` | Doctor name (white text) | `h2.text-white` |
| `navFrontdesk` | Frontdesk in nav bar | `nav a[href="/clinic/settings/frontdesk"]` |
| `frontdeskCardLink` | Frontdesk Staff card | `a[href="..."]` filtered by "Frontdesk Staff" |
| `formsLink` | Form Settings link | `a[href="/clinic/settings/forms"]` |
| `logoutButton` | Full-width Logout button | `button.w-full` filtered by "Logout" |

**Key methods:** `navigate()`, `goToForms()`, `clickLogout()`, `goToFrontdeskViaNav()`, `goToFrontdeskViaCard()`

**Key lesson — two elements with same href:** Profile page has TWO links with
`href="/clinic/settings/frontdesk"` — one in the nav bar and one in the Frontdesk card.
- `navFrontdesk` is scoped to `nav a[href=...]` — matches only the nav bar link
- `frontdeskCardLink` uses `.filter({ hasText: 'Frontdesk Staff' })` — matches only the card

---

### FormsPage.ts — `/clinic/settings/forms`

The most complex page object. Uses **private helpers** to scope locators to a specific section or field row so they never match the wrong element.

#### Private helpers (used internally, not by tests)

```typescript
// Finds the white card container for a whole section (header + fields + add button)
// WHY filter by h3? each section card has exactly one h3 with the section name
getSectionContainer(sectionLabel: string): Locator {
  return page.locator('div.bg-white.rounded-2xl')
    .filter({ has: page.locator('h3').filter({ hasText: sectionLabel }) });
}

// Finds a single field row by the field's label text
// WHY px-5? the row class is "flex items-center gap-3 px-5 py-3.5" — unique to field rows
getFieldRow(fieldLabel: string): Locator {
  return page.locator('div.flex.items-center.gap-3.px-5')
    .filter({ hasText: fieldLabel });
}
```

#### Key locators

| Locator | Element | How found |
|---|---|---|
| `pageHeading` | "Form Settings" h1 | `locator('h1')` |
| `headerSaveButton` | Save button in top-right | `header` scoped + `getByRole('button', { name: /Save Changes|Saved/ })` |
| `dermatologyButton` | Dermatology card | `getByRole('button', { name: /Dermatology/ })` |
| `cosmetologyButton` | Cosmetology card | `getByRole('button', { name: /Cosmetology/ })` |
| `unsavedChangesIndicator` | Amber "Unsaved changes" badge | `getByText('Unsaved changes')` |
| `addFieldModalHeading` | "Add Custom Field" modal title | `locator('h3').filter({ hasText: 'Add Custom Field' })` |
| `deleteConfirmRemoveButton` | "Remove" button in confirm modal | `getByRole('button', { name: 'Remove', exact: true })` |

**Why `exact: true` on the Remove button?**
`getByRole` does substring matching by default. Every field row has a trash icon button
with `title="Remove field"` — its accessible name is "Remove field". Without `exact: true`,
`{ name: 'Remove' }` matches ALL of them (18 elements → strict mode violation).
`exact: true` matches ONLY the button whose accessible name is **exactly** "Remove" — which is the modal's confirm button.

**Why header-scoped save button?**
Both the header and the bottom of the page have a "Save Changes" button. Scoping to
`header` makes the locator unambiguous regardless of which button is visible.

#### Key getters

| Method | What it returns |
|---|---|
| `getSectionBadge(label)` | The "Active" or "Hidden" badge for a section |
| `getFieldToggle(label)` | The green/gray pill toggle for a field |
| `getFieldRequiredPill(label)` | The "Required" or "Optional" pill for a field |
| `getToast(message)` | Any toast containing that message text |
| `getHeaderSaveButton()` | The header save button (for state assertions) |

**Why `getSectionBadge` uses `>`?**
```typescript
getSectionBadge(label): Locator {
  return getSectionContainer(label).locator('div.px-5.py-4 > span');
}
```
The `>` (direct child selector) prevents accidentally matching the `<span>` inside the
toggle button, which is NOT a direct child of the header row.

---

### FrontdeskPage.ts — `/clinic/settings/frontdesk`

#### Add Staff modal locators

| Locator | Element | How found |
|---|---|---|
| `pageHeading` | "Frontdesk Staff" h1 | `locator('h1')` |
| `staffCountText` | "{n} staff members" text | `p.text-base.text-gray-500` |
| `addStaffTopButton` | Add Staff button (top right) | `button:has(svg)` filtered by "Add Staff" |
| `modalHeading` | Add modal title | `h3` filtered by `"Add Frontdesk Staff"` |
| `staffNameInput` | Name field in Add modal | `getByPlaceholder('Staff member name')` |
| `staffPhoneInput` | Phone field in Add modal | `getByPlaceholder('10-digit number')` |
| `submitButton` | Submit in Add modal | `form button[type="submit"]` |
| `successToast` | Add success message | `getByText('Frontdesk staff added successfully!')` |
| `staffUpdatedToast` | Edit success message | `getByText('Staff updated successfully!')` |
| `editButtons` | All Edit buttons | `button[title="Edit"]` |

#### Edit Staff modal locators (different component, different DOM)

The Add modal and Edit modal are separate React components. Their DOM differs significantly:

| What differs | Add modal | Edit modal |
|---|---|---|
| Heading | `"Add Frontdesk Staff"` | `"Edit Staff"` |
| Name input | Has `placeholder="Staff member name"` | No placeholder — pre-filled from DB |
| Phone input | Has `placeholder="10-digit number"` | No placeholder — pre-filled from DB |
| Email input | Editable | Read-only (`disabled`) |
| Password label | "Minimum 6 characters" placeholder | "Enter new password" placeholder |
| Submit button | `type="submit"` | `"Save Changes"` button by role |

**Edit modal locator methods** (defined as dynamic getters, not constructor properties):

| Method | Locator used | Why |
|---|---|---|
| `getEditModalHeading()` | `h3` filtered by `"Edit Staff"` | Different heading from add modal |
| `getSaveChangesButton()` | `getByRole('button', { name: 'Save Changes' })` | Submit button uses text, not type |
| `getEditNameInput()` | `form input[type="text"]` | No placeholder on pre-filled input; `getByLabel` fails (no `for`/`id` link) |
| `getEditPhoneInput()` | `form input[type="tel"]` | Same reason — type is unique in the form |

**Why `getByLabel` fails here:**
The edit form uses `<label>Full Name *</label>` and `<input type="text">` as plain siblings inside a `<div>`. There is no `for`/`id` link and the input is not nested inside the label. Playwright's `getByLabel` cannot associate them — it finds nothing.

**Key methods:**
- `getStaffCount()` — reads the staff count number from the text
- `waitForStaffList()` — waits for DOM proof that staff data loaded (Edit buttons or empty state)
- `getEditButtonForStaff(name)` — scoped to the staff row containing `name`, returns its Edit button
- `getDeactivateButtonForStaff(name)` — scoped to the staff row containing `name`, returns its Deactivate button

---

### FrontdeskLoginPage.ts — `/frontdesk/login`

| Locator | Element | How found |
|---|---|---|
| `emailInput` | Email field | `getByPlaceholder('frontdesk@clinic.com')` |
| `passwordInput` | Password field | `getByPlaceholder('Enter your password')` |
| `signInButton` | Sign In button | `getByRole('button', { name: 'Sign In' })` |
| `errorDiv` | Red error container | `locator('div.bg-red-50.border-red-200')` |
| `doctorLoginLink` | "Doctor Login" link | `locator('a[href="/login"]')` |

**Key methods:** `navigate()`, `login(email, password)`

**Why no storageState here:** The frontdesk portal stores auth in `localStorage`
(`frontdeskToken` and `frontdeskStaff`), not in cookies. Playwright's `storageState`
saves cookies and sessionStorage only — localStorage is excluded. There is therefore
no auth file to pre-load for frontdesk tests. Every test that needs an authenticated
frontdesk session must go through the real login UI.

---

### FrontdeskDashboardPage.ts — `/frontdesk/dashboard`

| Locator | Element | How found |
|---|---|---|
| `clinicNameHeading` | Clinic name | `locator('h1')` |
| `welcomeHeading` | "Good {Morning/Afternoon/Evening}…" heading | `locator('h2').filter({ hasText: /Good/ })` |
| `logoutButton` | Logout button | `getByRole('button', { name: 'Logout' })` |
| `navDashboard` | Dashboard nav link | `locator('a[href="/frontdesk/dashboard"]')` |
| `navAppointments` | Appointments nav link | `locator('a[href="/frontdesk/appointments"]')` |
| `navPatients` | Patients nav link | `locator('a[href="/frontdesk/patients"]')` |
| `navPharmacy` | Pharmacy nav link | `locator('a[href="/frontdesk/pharmacy"]')` |
| `navSales` | Sales nav link | `locator('a[href="/frontdesk/sales"]')` |

**Key methods:** `navigate()`, `waitForLoad()`, `logout()`, `goToAppointments()`, `goToPatients()`, `goToPharmacy()`, `goToSales()`

**Why `waitForLoad()` waits on `welcomeHeading`:** The welcome heading
(`"Good Morning/Afternoon/Evening, {firstName}!"`) is only rendered after the app
reads and parses the staff object from localStorage. Its appearance confirms the
entire authenticated dashboard shell is ready. The timeout is 15000ms to account for
slow React render cycles on first load after a redirect.

---

### FrontdeskPatientsPage.ts — `/frontdesk/patients`

| Locator | Element | How found |
|---|---|---|
| `pageHeading` | "Patients" h1 | `locator('h1')` |
| `addPatientButton` | Add Patient header button | `header button:has(svg)` filtered by "Add Patient" |
| `modalHeading` | "Add New Patient" h2 | `locator('h2').filter({ hasText: 'Add New Patient' })` |
| `fullNameInput` | Full Name field | `getByPlaceholder('Enter patient name')` |
| `ageInput` | Age field | `getByPlaceholder('Age')` |
| `genderFemaleButton` | Female gender button | `getByRole('button', { name: 'Female', exact: true })` |
| `phoneInput` | Phone field | `getByPlaceholder('10-digit phone number')` |
| `submitButton` | Add Patient submit | `form button[type="submit"]` |
| `successToast` | Success message | `getByText(/added successfully/)` |

**Key methods:** `navigate()`, `waitForLoad()`, `clickAddPatient()`, `fillNewPatient(data)`, `submitAndWaitForToast()`

**Why `exact: true` on gender buttons:** Three buttons — "Male", "Female", "Other" — may partially match each other without exact matching. `exact: true` ensures each role matches only the intended button.

**Why form-scoped submit button:** The header also contains a teal "Add Patient" button. Scoping to `form button[type="submit"]` targets only the modal submit and prevents a strict mode violation.

---

### FrontdeskAppointmentsPage.ts — `/frontdesk/appointments`

| Locator | Element | How found |
|---|---|---|
| `pageHeading` | "Appointments" h1 | `locator('h1')` |
| `bookAppointmentButton` | Book Appointment header button | `header button:has(svg)` filtered by "Book Appointment" |
| `modalHeading` | "Book Appointment" h2 | `locator('h2').filter({ hasText: 'Book Appointment' })` |
| `patientSearchInput` | Patient search field | `getByPlaceholder('Search by phone number, name, or patient ID...')` |
| `patientResultsList` | Results dropdown container | `locator('div.max-h-48')` |
| `modalDateInput` | Date picker in modal | `form input[type="date"]` |
| `timeSlotsGrid` | Time slot grid container | `locator('div.grid.grid-cols-4')` |
| `feeInput` | Consultation fee field | `getByPlaceholder('e.g. 500')` |
| `confirmBookingButton` | Confirm Booking submit | `form button[type="submit"]` |
| `successToast` | Booking success message | `getByText(/Appointment booked for/)` |

**Key methods:** `navigate()`, `waitForLoad()`, `clickBookAppointment()`, `typePatientSearch(query)`, `selectPatient(name)`, `clickFirstAvailableSlot()`, `fillFee(amount)`, `confirmAndWaitForToast()`

**Why search and select are separate methods:** `typePatientSearch()` just fills the input. `selectPatient()` separately waits for results (up to 10000ms) and clicks. This split models the 400ms debounce — the test must not assume results exist immediately after typing.

**Why `clickFirstAvailableSlot()` uses `hasNot`:** Booked slots have a `<span class="line-through">` inside them. `filter({ hasNot: page.locator('span.line-through') })` excludes all booked slots and targets only available ones without needing to know exact slot times.

---

## Tests Written

### logout.spec.ts — 5 tests ✅

| # | Test name | What it verifies |
|---|---|---|
| 1 | Logout from dashboard | Click Logout on dashboard → URL becomes `/login` |
| 2 | Logout from profile page | Click Logout on profile page → URL becomes `/login` |
| 3 | localStorage is cleared | After logout → `localStorage.getItem('token')` returns `null` |
| 4 | Dashboard route locked | After logout, go to `/clinic/dashboard` directly → redirected to `/login` |
| 5 | Profile route locked | After logout, go to `/clinic/profile` directly → redirected to `/login` |

**Key technique:** Reading localStorage from inside the browser:
```typescript
const token = await page.evaluate(() => localStorage.getItem('token'));
expect(token).toBeNull();
```
`page.evaluate()` runs JavaScript code INSIDE the browser tab — the only way to access
localStorage from a Playwright test.

**These tests prove:** A logged-out user cannot access any protected page, and their
auth token is fully removed (not just the page redirected).

---

### forms.spec.ts — 7 tests ✅

**Special setup:** Uses `storageState` to skip UI login and `beforeAll` to normalize the database.

```typescript
// Inside test.describe block — applies to all 7 tests
test.use({ storageState: 'playwright/.auth/user.json' });
```

This loads the saved auth token into localStorage before each test instead of doing a UI login.

#### `beforeAll` hook — database normalizer

Runs **once before all 7 tests**. Checks three fields that tests modify and restore.
If a previous run crashed mid-save, these could be left in the wrong state:

| What it checks | Expected state | If wrong: |
|---|---|---|
| Clinical Examination badge | "Active" | Clicks section toggle to re-enable |
| Duration field toggle | green (enabled) | Clicks field toggle to re-enable |
| Previous Treatment pill | "Optional" | Clicks pill to switch back to Optional |

If any change was made, saves once with `clickSaveHeader()` and waits for the button
to return to "Saved" state (confirms API call completed).

#### The 7 tests

| # | Test name | What it verifies |
|---|---|---|
| 1 | Navigation path | dashboard → profile → form settings works; Dermatology is selected by default |
| 2 | Section toggle | Disable "Clinical Examination" → save → badge shows "Hidden"; re-enable → save → "Active" |
| 3 | Field toggle | Disable "Duration" → save → toggle is gray; re-enable → save → toggle is green |
| 4 | Required/Optional | Switch "Previous Treatment" Optional → Required → save; switch back → save |
| 5 | Required pill disabled | When field is off, its Required pill gets HTML `disabled` and tooltip "Enable field first" |
| 6 | Custom field lifecycle | Add "Skin Texture Test" → save; then delete it → confirm → save |
| 7 | Empty label validation | Submit Add Field modal with no label → "Field label is required." shown; modal stays open |

**Each state-changing test restores the database** (toggles back and saves) so the next
test run starts in a known clean state.

---

### cosmetology-forms.spec.ts — 7 tests ✅

Mirrors `forms.spec.ts` exactly in structure. The only architectural difference is that
every test calls `goToCosmForms()` instead of `goToForms()` — this helper adds one extra
step: clicking the Cosmetology card button before waiting for sections to load.

**Cosmetology form structure (5 sections):**

| Section | Fields |
|---|---|
| Patient Information | Skin Type (Fitzpatrick) — Optional, Primary Concern — Required |
| Assessment & Analysis | Clinical Findings, Assessment/Diagnosis, Baseline Evaluation, Contraindications Check — all Optional |
| Procedure Details | Procedure Name, Treatment Goals, Session Number, Package/Plan, Products & Parameters, Immediate Outcome |
| Aftercare & Follow-up | Prescription (Rx), Aftercare Instructions, Home Products Recommended, Follow-up Date, Expected Results Timeline |
| Consent & Risks | Risks Explained, Consent Confirmed |

**Tab selection CSS:** Cosmetology uses `border-purple-500 bg-purple-50` when selected.
Dermatology uses `border-teal-500`. They are different — do not assume both share the
same class.

**`beforeAll` normalization — Cosmetology specific fields:**

| What it checks | Expected state |
|---|---|
| Assessment & Analysis badge | "Active" |
| Assessment/Diagnosis field toggle | green (enabled) |
| Clinical Findings pill | "Optional" |

**Critical:** `beforeAll` must call `selectCosmetology()` and `waitForCosmetologyLoad()`
BEFORE reading any state. Without this, it reads Dermatology data and the lookup for
"Assessment & Analysis" times out (that section does not exist in Dermatology).

#### The 7 tests

| # | Test name | What it verifies |
|---|---|---|
| 1 | Tab switch | Dashboard → profile → forms; click Cosmetology → `border-purple-500` appears, Dermatology loses `border-teal-500` |
| 2 | Section toggle | Disable "Assessment & Analysis" → save → badge shows "Hidden"; re-enable → save → "Active" |
| 3 | Field toggle | Disable "Assessment/Diagnosis" → save → toggle is gray; re-enable → save → toggle is green |
| 4 | Required/Optional | Switch "Clinical Findings" Optional → Required → save; switch back → save |
| 5 | Required pill disabled | When "Baseline Evaluation" field is off, its Required pill gets HTML `disabled` + tooltip "Enable field first" |
| 6 | Custom field lifecycle | Add "Cosmo Texture Test" to Assessment & Analysis → save; delete it → confirm → save |
| 7 | Empty label validation | Submit Add Field modal with no label → "Field label is required." shown; modal stays open |

---

### frontdesk-book-appointment.spec.ts — 1 test ✅

End-to-end booking workflow covering all four frontdesk pages in sequence.

| Step | Action | Assert |
|---|---|---|
| 1 | Generate unique `name` + `phone` using `Date.now()` | — |
| 2 | Navigate to `/frontdesk/login` | — |
| 3 | Login with `FRONTDESK_EMAIL` + `FRONTDESK_PASSWORD` | — |
| 4 | Wait for `waitForURL(/frontdesk\/dashboard/)` | — |
| 5 | `dashboardPage.waitForLoad()` | welcome heading visible |
| 6 | `dashboardPage.goToPatients()` → `waitForURL` | — |
| 7 | — | `pageHeading` has text "Patients" |
| 8 | Open Add Patient modal | modal heading "Add New Patient" visible |
| 9 | Fill name, age=30, gender=female, phone | — |
| 10 | Submit form | `successToast` visible within 10000ms |
| 11 | `patientsPage.goToAppointments()` → `waitForURL` | — |
| 12 | — | `pageHeading` has text "Appointments" |
| 13 | Open Book Appointment modal | modal heading "Book Appointment" visible |
| 14 | Type phone into patient search | — |
| 15 | `selectPatient(name)` — waits for debounce + results | — |
| 16 | `clickFirstAvailableSlot()` — waits for slots grid | — |
| 17 | Fill fee "500" | — |
| 18 | `confirmAndWaitForToast()` — clicks submit, waits for toast | `successToast` visible |

**Why real UI login (no storageState):** The frontdesk portal uses localStorage auth which storageState cannot capture. Every frontdesk test must go through the login UI.

**Phone uniqueness strategy:** `'9' + String(Date.now()).slice(-9)` — always produces a valid 10-digit Indian mobile number (starts with 9) that is unique across runs because the last 9 digits of the epoch timestamp change with every millisecond.

**Why search by phone (not name) in the booking modal:** The patient search accepts phone, name, and patient ID. Phone is the most specific: the name contains a timestamp but the search results show all fuzzy matches. Phone returns exactly one result — the patient we just created.

---

### frontdesk-portal-login.spec.ts — 3 tests ✅

Tests for the frontdesk staff portal login flow at `/frontdesk/login`.

| # | Test name | What it verifies |
|---|---|---|
| 1 | Successful login — URL becomes /frontdesk/dashboard and welcome heading is visible | Correct credentials → URL changes to `/frontdesk/dashboard`, welcome heading is visible (confirms localStorage was written and React consumed it) |
| 2 | Wrong password — error message visible, URL stays on /frontdesk/login | Wrong password → red error container (`div.bg-red-50.border-red-200`) is visible, URL stays on `/frontdesk/login` |
| 3 | Successful login then logout — URL returns to /frontdesk/login | Login succeeds → Logout clicked → URL returns to `/frontdesk/login` |

**Why no storageState:** The frontdesk portal stores auth in `localStorage`
(`frontdeskToken`, `frontdeskStaff`), not in cookies. Playwright's `storageState`
only saves cookies and sessionStorage — not localStorage. There is no auth file to
pre-load, so these tests go through the real login UI every time.

These tests ARE testing the login UI, so going through the real flow is correct here.
There is no rate-limiter concern: the frontdesk login endpoint allows 10 attempts per
15 minutes per IP (the clinic admin login blocks at approximately 3 rapid attempts).

**Future dashboard tests** that need an authenticated frontdesk session without
testing the login flow itself should use `page.addInitScript()` to inject
`frontdeskToken` and `frontdeskStaff` into localStorage before navigation.
See Key Pattern 2 below.

---

### dashboard.spec.ts

| Test | What it does |
|---|---|
| `should show clinic name after login` | Logs in, verifies URL, app name "DermaCloud", and clinic name from `.env` |
| `should show all navigation links` | Verifies all 7 nav links are visible on dashboard |
| `should navigate to profile when Profile is clicked` | Clicks Profile, verifies URL changes to `/clinic/profile` |

---

### frontdesk.spec.ts — 3 tests ✅

3 tests covering 3 different navigation paths to the frontdesk page. Each path then
adds a staff member and verifies count increases and buttons appear.

| Test | Navigation path |
|---|---|
| Way 1 | Login → Dashboard → Frontdesk nav link |
| Way 2 | Login → Dashboard → Profile → Frontdesk nav link |
| Way 3 | Login → Dashboard → Profile → Frontdesk Staff card |

**Note:** These tests use full UI login (no storageState) because they specifically test navigation paths that start from the login page. Each adds a real staff member using a `Date.now()` timestamp email to avoid duplicates.

---

### frontdesk-edit.spec.ts — 1 test ✅

**Special setup:** Uses `storageState` (like forms tests) to avoid the login rate limiter.
No `beforeAll` needed — the test creates its own fresh staff member to ensure known name/phone values.

**Test flow:**

| Step | Action | Assert |
|---|---|---|
| 1 | Navigate to `/clinic/settings/frontdesk` | — |
| 2 | Call `waitForStaffList()` | — |
| 3 | Add a new staff member with timestamp name + known phone | Add modal closes; success toast; Edit button appears |
| 4 | Click Edit on that staff card | Edit modal heading `"Edit Staff"` is visible |
| 5 | — | Name input has value = original name |
| 5 | — | Phone input has value = original phone |
| 6 | Fill new name + new phone | — |
| 7 | Click `"Save Changes"` button | — |
| 8 | — | `"Staff updated successfully!"` toast visible within 10 s |
| 9 | — | Edit modal heading gone from DOM |
| 10 | — | Staff card shows new name (Edit button visible for new name) |

**Why add staff inside the test (not beforeAll):**
The pre-fill assertion (`toHaveValue`) needs to know the EXACT name and phone that were saved.
Using a timestamp name (`Edit Test ${Date.now()}`) guarantees uniqueness and means we know the exact values to assert against.
A `beforeAll` approach would require checking whether the staff already exists — more complex and fragile.

**Why `{ timeout: 10000 }` on the updated toast:**
The edit is a PUT API call to MongoDB. Write operations are slower than reads.
5 seconds timed out in practice — the toast appeared just after the window expired.
The failure screenshot confirmed this: the toast was visible at the exact moment Playwright gave up.

---

## Key Patterns & Lessons Learned

### 1. storageState — login once, share the session

Playwright can save the entire browser storage (localStorage + cookies) to a JSON file
and load it for future tests. This means you login ONCE in `global-setup.ts` and every
test starts already authenticated — no rate limiting, no repeated login UI.

```typescript
// global-setup.ts: save after successful login
await page.context().storageState({ path: 'playwright/.auth/user.json' });

// forms.spec.ts: load before each test
test.use({ storageState: 'playwright/.auth/user.json' });
```

**Important:** `logout.spec.ts` does NOT use storageState — those tests specifically
test the login/logout flow, so they need a fresh unauthenticated state.

---

### 2. localStorage auth — why storageState doesn't apply to frontdesk

The DermaCloud application has two separate authenticated portals that use
**different auth storage mechanisms**:

| | Clinic admin portal | Frontdesk portal |
|---|---|---|
| Auth stored in | Cookie (HttpOnly) | `localStorage` |
| `storageState` works? | Yes | No |
| Skip-login trick | `test.use({ storageState: AUTH_FILE })` | `page.addInitScript()` with token injection |
| Rate limit concern | Yes (~3 rapid logins blocked) | Less strict (10 per 15 min) |
| Login test approach | Real UI (`logout.spec.ts`, `login.spec.ts`) | Real UI (`frontdesk-portal-login.spec.ts`) |

**Why storageState does not help for frontdesk:**
Playwright's `storageState` serialises cookies and sessionStorage to a JSON file.
The frontdesk portal stores its JWT as `localStorage.setItem('frontdeskToken', token)`
and the staff object as `localStorage.setItem('frontdeskStaff', JSON.stringify(staff))`.
localStorage is deliberately excluded from the `storageState` snapshot — these keys
never appear in `playwright/.auth/user.json`.

**The `addInitScript` solution for future non-login tests:**

For frontdesk tests that need an authenticated session but are NOT testing the login
UI itself (e.g. dashboard content, nav tabs, appointment list), use `page.addInitScript()`
to inject the tokens before any page script runs:

```typescript
// In beforeAll — do one real login via the API, capture the tokens
const response = await request.post('/api/auth/frontdesk/login', {
  data: { email: process.env.FRONTDESK_EMAIL, password: process.env.FRONTDESK_PASSWORD }
});
const { token, staff } = (await response.json()).data;

// In beforeEach — inject into localStorage BEFORE page navigation
// addInitScript runs before any page script — React mounts and already sees the tokens
await page.addInitScript(({ token, staff }) => {
  localStorage.setItem('frontdeskToken', token);
  localStorage.setItem('frontdeskStaff', JSON.stringify(staff));
}, { token, staff });

// THEN navigate — the page sees the tokens on first load
await page.goto('/frontdesk/dashboard');
```

**Why `addInitScript` must be called BEFORE `page.goto()`:**
`addInitScript` registers a script that runs in the browser before any page scripts
execute. If you call `goto()` first, the page already loaded and ran its own scripts
(which read localStorage and found nothing) — the tokens arrive too late.

---

### 3. beforeAll vs beforeEach (when to use each)

| | `beforeAll` | `beforeEach` |
|---|---|---|
| Runs | Once before the entire describe block | Before every single test |
| Use for | Database normalization, one-time setup | Creating page objects, resetting UI state |
| Has access to | `browser` fixture | `page` fixture |

```typescript
// beforeAll — runs once, creates its own browser context
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: AUTH_FILE });
  const page    = await context.newPage();
  // ... normalize DB ...
  await context.close();
});

// beforeEach — runs before every test, uses the test's page fixture
test.beforeEach(async ({ page }) => {
  formsPage = new FormsPage(page);
});
```

---

### 4. saveAndConfirm — wait for the button, not the toast

**Problem:** The success toast stays visible for 3.5 seconds. If a test saves twice
(Part A disable + Part B restore), the Part A toast is still on screen when Part B's
`saveAndConfirm` runs. The toast check passes immediately — but the Part B API call
hasn't actually completed. The browser context closes, the in-flight request is cancelled,
and the database is NOT updated.

**Fix:** Wait for the **header save button to return to "Saved"** instead of the toast.
The button only changes to "Saved" when `setHasChanges(false)` is called inside the
API success handler — guaranteed to happen AFTER the API call completes.

```typescript
async function saveAndConfirm(formsPage: FormsPage) {
  await expect(formsPage.getHeaderSaveButton()).toContainText('Save Changes'); // confirm unsaved state
  await formsPage.clickSaveHeader();                                           // trigger save
  await expect(formsPage.getHeaderSaveButton()).toContainText('Saved', { timeout: 10000 }); // API done
}
```

---

### 5. Toast vs field row — CSS collision

The DermaCloud toast div and field row divs share the **same CSS class combination**:
```
flex items-center gap-3 px-5 py-3.5
```

This means `page.locator('div.flex.items-center.gap-3.px-5').filter({ hasText: '...' })`
could match a toast (if the toast message contains that text) instead of the field row.

**Fix:** Scope the locator to the **section card container** (`div.bg-white.rounded-2xl`).
The toast is `position: fixed` and lives outside the section cards — it can never be
inside a section card container.

```typescript
// WRONG — could match the toast
page.locator('div.flex.items-center.gap-3.px-5').filter({ hasText: 'Skin Texture Test' })

// CORRECT — scoped to section card, toast is outside this container
page.locator('div.bg-white.rounded-2xl')
  .filter({ has: page.locator('h3').filter({ hasText: 'Clinical Examination' }) })
  .locator('div.flex.items-center.gap-3.px-5')
  .filter({ hasText: 'Skin Texture Test' })
```

---

### 6. count() in a while loop for cleanup

`locator.count()` returns the current number of matching elements in the DOM **at the
moment it is called** — it does NOT wait, and it does NOT cache. Each loop iteration
queries the live DOM fresh.

```typescript
while (await leftoverRows.count() > 0) {
  await leftoverRows.first().locator('button[title="Remove field"]').click({ force: true });
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  // Wait for removal confirmation before checking count again
  await page.getByText(`"${label}" removed`).waitFor({ state: 'visible', timeout: 5000 });
}
```

**Why `force: true`?** When a field was left from a previous test run and the section
was just re-enabled (in `beforeAll`), the React re-render may still be completing.
`force: true` bypasses Playwright's actionability wait and dispatches the click event
directly on the element.

---

### 7. exact: true in getByRole

`getByRole('button', { name: 'Remove' })` does **substring matching** by default.
Every trash icon button has `title="Remove field"` — its accessible name is "Remove field",
which contains "Remove". So the locator would match all 18 trash buttons.

```typescript
// WRONG — matches all buttons with "Remove" anywhere in name (18 elements)
page.getByRole('button', { name: 'Remove' })

// CORRECT — matches only buttons whose accessible name is exactly "Remove" (1 element)
page.getByRole('button', { name: 'Remove', exact: true })
```

---

### 8. page.evaluate() — run JavaScript inside the browser

Used to read or write things in the browser that Playwright can't access directly,
like `localStorage`:

```typescript
// Read the auth token from localStorage
const token = await page.evaluate(() => localStorage.getItem('token'));
expect(token).toBeNull(); // verify it was cleared by logout
```

---

### 9. Unique emails per test run

Staff emails use `Date.now()` timestamp so every run creates fresh records:
```typescript
const ts = Date.now();
email: `staffone${ts}@dermacloud.com`  // e.g. staffone1745123456789@dermacloud.com
```
Without this, the second run gets "email already exists" and the modal never closes.

---

### 10. Read Playwright's error output — Received string is the truth

When a `toHaveClass` or `toHaveText` assertion fails, Playwright always shows:

```
Expected pattern: /your-guess/
Received string:  "the actual value from the live DOM"
```

The `Received string` is the **real class list / text** of the element in the browser at that moment.
Fix the test by changing your expected value to match what Received shows.

Example: we expected `border-violet-500`, Playwright received `border-purple-500`. One word change fixed it.

---

### 11. Screenshot and error-context.md after every failure

Every failure writes two files to `test-results/<test-name>/`:

- `test-failed-1.png` — screenshot of the browser at the moment the assertion failed
- `error-context.md` — full YAML DOM snapshot of the page

The DOM snapshot is especially useful: it lists every `heading`, `button`, and `paragraph`
on the page with its actual text. This is how we discovered the real Cosmetology section
names (`Assessment & Analysis`, `Procedure Details`, etc.) without having to open the app.

---

### 12. waitForLoad after switching form types

After clicking the Cosmetology button, the page re-fetches from the API and sections
briefly disappear before Cosmetology data renders. Always call `waitForCosmetologyLoad()`
after `selectCosmetology()`:

```typescript
await formsPage.selectCosmetology();
await formsPage.waitForCosmetologyLoad(); // waits for Patient Information h3 to appear
```

Without this, the next action could read stale Dermatology data still in the DOM.

---

### 14. Add modal vs Edit modal — assume nothing, verify everything

The Add and Edit versions of a form are often separate React components. They can differ in:
- Heading text (`"Add Frontdesk Staff"` vs `"Edit Staff"`)
- Whether inputs have placeholder attributes (Add = empty field with placeholder, Edit = pre-filled, no placeholder)
- Submit button type (`type="submit"` vs `getByRole('button', { name: 'Save Changes' })`)
- Which fields are editable (Edit modal disables email — it cannot be changed)

**Rule:** Do not copy Add modal locators for Edit modal tests. Run the test, read the failure screenshot, and derive the real selectors from what the browser shows.

---

### 15. When `getByLabel` fails — use `input[type]` scoped to the form

`getByLabel` requires one of:
- `<label for="id">` + `<input id="id">` (explicit)
- `<label><input></label>` (implicit wrapping)

If the form uses labels and inputs as plain siblings with no `for`/`id`, `getByLabel` finds nothing.

**Alternative — `input[type]` scoped to `form`:**
```typescript
// Works when each input type appears once in the form
page.locator('form input[type="text"]')   // Full Name
page.locator('form input[type="tel"]')    // Phone
page.locator('form input[type="email"]')  // Email
```

Scoping to `form` prevents matching inputs outside the modal (e.g., search boxes on the page behind).

---

### 16. Timeout sizing — 5000ms for reads, 10000ms for writes

| API type | Operation | Recommended timeout |
|---|---|---|
| GET (read) | Page load, list fetch, navigation | 5000ms |
| POST (create) | Add staff, submit form | 5000ms (usually fast) |
| PUT (update) | Edit staff, save form settings | 10000ms |
| DELETE (remove) | Delete field, deactivate | 10000ms |

The toast's auto-dismiss timer starts when it **appears**, not when you start waiting.
A longer wait for the toast to appear does not reduce the window you have to catch it.

---

### 17. Read failure screenshots first — before anything else

When a test fails:
1. Open `test-results/<test-name>/test-failed-1.png`
2. Look at what the browser shows at the exact failure moment
3. The heading text, pre-filled values, toast message, button labels — all visible directly

This is faster than adding `console.log`, re-running with `--debug`, or opening DevTools.
The screenshot is the ground truth of what the DOM contained at failure time.

### 13. waitForStaffList() instead of waitForLoadState('networkidle')

The frontdesk page fetches staff from MongoDB inside a React `useEffect`. The page is
already in "networkidle" state by the time `useEffect` fires — so `waitForLoadState('networkidle')`
returns immediately and reads "0 staff members" (the initial React state).

**Fix:** Wait for actual DOM proof that data loaded:
```typescript
await Promise.race([
  this.editButtons.first().waitFor({ state: 'visible', timeout: 10000 }),
  this.addStaffMemberButton.waitFor({ state: 'visible', timeout: 10000 }),
]);
```

---

## Bugs Hit and Fixed

| # | Bug | Cause | Fix |
|---|---|---|---|
| 1 | Forgot Password link not found | `?` broke regex in `getByRole` | Use `href` attribute selector instead |
| 2 | Dashboard URL timeout | Login has async redirects — 15s wasn't enough | Increase to 30s, use regex pattern |
| 3 | Staff count reads 0 | `networkidle` returned before React `useEffect` fetched data | Wait for Edit button to appear instead |
| 4 | Count doesn't update after adding staff | Old Edit buttons already visible — `waitForStaffList` returned too early | Use `expect(locator).toContainText()` which retries |
| 5 | Modal never closed | Duplicate email in DB from previous run | Use `Date.now()` in email address |
| 6 | Strict mode: 5 elements matched | "Staff One" reused every run — 5 rows in DB after 5 runs | Add `.first()` to the locator |
| 7 | navFrontdesk strict mode on profile | Profile page has 2 links with same `href` | Scope to `nav a[href=...]` |
| 8 | Rate limiter blocks tests 4–7 | 7 tests each doing UI login — rate limit hit after ~3 | Use `globalSetup` + `storageState` to login once |
| 9 | Restore saves don't persist | Part A toast still visible when Part B saves — check passes immediately, context closes before API finishes | Wait for button "Saved" state instead of toast |
| 10 | `beforeAll` cleanup times out | Toast div has same CSS classes as field rows — locator matched toast instead of field, no trash button inside toast | Scope cleanup locator to section card container |
| 11 | `Remove` button strict mode: 18 elements | `getByRole({ name: 'Remove' })` substring-matched all "Remove field" trash buttons | Add `exact: true` |
| 12 | 2 "Skin Texture Test" fields in DB | Test 6 failed after Part A save but before Part B delete — field accumulated over runs | Add pre-cleanup loop inside test 6 itself |
| 13 | `beforeAll` timeout — "Clinical Examination" not found | `beforeAll` ran without switching to Cosmetology first — tried to find a Dermatology section in the Cosmetology form | Call `selectCosmetology()` + `waitForCosmetologyLoad()` before any state reads in `beforeAll` |
| 14 | `border-violet-500` assertion failed | Guessed the Cosmetology selected border was violet — it is actually `border-purple-500` | Read Playwright's `Received string` in the error output — it shows the exact class |
| 15 | Edit modal heading not found | Assumed heading was `"Edit Frontdesk Staff"` — actual heading is `"Edit Staff"` (different component) | Read failure screenshot; heading text is visible directly in the browser |
| 16 | `getByLabel('FULL NAME')` not found | Labels have no `for` attribute and inputs have no `id` — Playwright cannot associate them. Also the CSS makes "Full Name *" look uppercase but real HTML text is mixed case | Use `form input[type="text"]` and `form input[type="tel"]` scoped to the form instead |
| 17 | `getByPlaceholder('Staff member name')` not found in edit modal | Edit modal name input has no `placeholder` attribute — pre-filled inputs in this component don't have one | Same fix as Bug 16 — use `input[type]` scoped to `form` |
| 18 | `"Staff updated successfully!"` toast not found within 5000ms | PUT API call to MongoDB took slightly longer than 5 s; toast appeared just after timeout | Increase toast timeout to `{ timeout: 10000 }` for write (POST/PUT) operations |

---

## Pending Tests

See `pending.md` for the full grouped list. Summary:

- **Login** — success test with real credentials, wrong password error, empty field validation
- **Signup** — password strength checks (8+ chars, uppercase, lowercase, number, special char)
- **Frontdesk** — ~~Edit staff~~ ✅ done (`frontdesk-edit.spec.ts`)
- **Frontdesk** — Deactivate staff (status badge changes, button title changes)
- **Frontdesk** — Activate staff (toggle back to Active)
- **Frontdesk** — Close modal without saving (X button, Cancel button)
- **Frontdesk** — Form validation (empty form, short password)
- **Form Settings (both forms)** — Bottom Save button states, Cancel Add modal, Cancel Delete modal, textarea type, Cosmetology → Dermatology back-switch, batch save (multiple changes before one save)
- **Form Settings — Dermatology** — Section toggle on all remaining sections; fields outside Clinical Examination; Add Custom Field in other sections
- **Form Settings — Cosmetology** — Patient Information fields (Skin Type, Primary Concern); Procedure Details section + all 6 fields; Aftercare & Follow-up section + all 5 fields; Consent & Risks section + both fields; Add Custom Field in other sections
