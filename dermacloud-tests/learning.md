# Playwright Learning Journal

Everything learned from scratch — starting from zero Playwright knowledge,
coming from a Selenium Java background.

---

## Chapter 1 — Setup

### What we installed

```bash
npm init -y                          # creates package.json (project config file)
npm init playwright@latest           # installs Playwright and creates sample files
```

Playwright creates:
- `tests/` folder with a sample test
- `playwright.config.ts` — the global settings file
- `package.json` — lists all dependencies

### What is Node.js and why do we need it?
Playwright runs on Node.js — it's the engine that lets JavaScript/TypeScript run on your
computer (outside the browser). Like how Java needs the JVM, Playwright needs Node.js.

### Running tests
```bash
npx playwright test                         # run all tests
npx playwright test filename.spec.ts        # run one file
npx playwright test filename.spec.ts --headed  # run with browser visible
npx playwright show-report                  # open the HTML result report
```

---

## Chapter 2 — TypeScript Basics (used in Playwright)

You came from Java, so TypeScript will feel familiar. Here are the key differences:

### Variables
```typescript
// Java:  String name = "hello";
// TS:
const name = "hello";   // constant — can't be reassigned
let count = 0;          // variable — can be reassigned
```

### async / await
Every Playwright action (click, fill, navigate) talks to the browser — which takes time.
We mark these as `async` and use `await` to say "wait for this to finish before moving on".

```typescript
// WITHOUT await — wrong, doesn't wait
page.click('button');
page.fill('input', 'hello');

// WITH await — correct, waits for each step
await page.click('button');
await page.fill('input', 'hello');
```

Think of `await` like `.get()` in Java's `Future` — it blocks until the result is ready.

### Interfaces
Defines the shape of an object — what fields it must have:
```typescript
interface StaffData {
  name:     string;
  email:    string;
  password: string;
  phone:    string;
}
```

### process.env and the ! operator
```typescript
process.env.TEST_EMAIL    // reads TEST_EMAIL from the .env file
process.env.TEST_EMAIL!   // the ! tells TypeScript "trust me, this value exists"
                          // without ! TypeScript warns it could be undefined
```

### Template literals (like String.format in Java)
```typescript
// Java:  String.format("staffone%d@test.com", timestamp)
// TS:
`staffone${timestamp}@test.com`   // backticks + ${} for variables inside strings
```

---

## Chapter 3 — Playwright Test Structure

### Basic test file structure
```typescript
import { test, expect } from '@playwright/test';

// test.describe = group of related tests (like a test class in JUnit)
test.describe('Login Page', () => {

  // beforeEach runs before EVERY test in this group
  // Use it for setup that all tests need (like logging in)
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  // test() = one individual test case
  test('should show error for wrong password', async ({ page }) => {
    await page.fill('input', 'wrong@email.com');
    await expect(page.locator('h1')).toBeVisible();
  });

});
```

### The { page } parameter
Every test gets a `page` object automatically from Playwright.
It represents the browser tab — you use it to navigate, click, type, etc.
You don't create it yourself; Playwright injects it.

---

## Chapter 4 — Page Object Model (POM)

### What is it?
A design pattern where each page of the app gets its own TypeScript class.
The class holds the locators and actions for that page.

### Why use it?
Without POM — if a button's CSS changes, you fix it in EVERY test file.
With POM — you fix it in ONE place (the page class), all tests automatically updated.

### Structure of a Page Object class
```typescript
import { Page, Locator } from '@playwright/test';

export class LoginPage {

  // Step 1: Declare locators as private variables
  private emailInput:   Locator;
  private signInButton: Locator;

  // Step 2: constructor — runs when you create a new LoginPage
  // Assigns real locators to each variable
  constructor(private page: Page) {
    this.emailInput   = page.getByPlaceholder('doctor@example.com');
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
  }

  // Step 3: Actions — methods that DO something
  async navigate() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.signInButton.click();
  }

  // Step 4: Getters — methods that RETURN locators so tests can assert on them
  getEmailInput():   Locator { return this.emailInput; }
  getSignInButton(): Locator { return this.signInButton; }
}
```

### Using a Page Object in a test
```typescript
test('login test', async ({ page }) => {
  const loginPage = new LoginPage(page);   // create the page object
  await loginPage.navigate();              // go to the page
  await loginPage.login('a@b.com', '123'); // call an action
  await expect(loginPage.getEmailInput()).toBeVisible(); // assert using getter
});
```

---

## Chapter 5 — Finding Elements (Locators)

Locators are how Playwright finds elements on the page. There are many ways.

### Method 1: getByPlaceholder
Best for input fields that have placeholder text.
```typescript
page.getByPlaceholder('doctor@example.com')
page.getByPlaceholder('Enter your password')
```

### Method 2: getByRole
Best for buttons, links, headings — semantic HTML elements.
```typescript
page.getByRole('button', { name: 'Sign In' })
page.getByRole('link', { name: 'Dashboard' })
page.getByRole('heading', { name: 'Login' })
```

**Lesson learned:** If the button/link name has special characters like `?`, `getByRole`
breaks because it treats the name as a regex. Fix: use `href` attribute instead.
```typescript
// WRONG — ? breaks regex
page.getByRole('link', { name: 'Forgot Password?' })

// CORRECT — use href attribute
page.locator('a[href="/forgot-password"]')
```

### Method 3: getByText
Best for elements identified purely by their text content.
```typescript
page.getByText('Frontdesk staff added successfully!')
```

### Method 4: locator() with CSS selectors
Most flexible — works like CSS selectors in browser DevTools.
```typescript
page.locator('h1')                          // any h1 element
page.locator('p.text-gray-500')             // p with class text-gray-500
page.locator('a[href="/clinic/dashboard"]') // a tag with specific href
page.locator('button[title="Go back"]')     // button with specific title
page.locator('button[type="submit"]')       // button with specific type
page.locator('form button[type="submit"]')  // submit button INSIDE a form
```

### Narrowing down locators

**:has() — find parent that contains a specific child**
```typescript
// Find a button that has an SVG icon inside it
page.locator('button:has(svg)')
```

**filter({ hasText }) — narrow down by text content**
```typescript
// From all h3 elements, find the one that says "Add Frontdesk Staff"
page.locator('h3').filter({ hasText: 'Add Frontdesk Staff' })

// From all buttons with SVG, find the one that says "Add Staff"
page.locator('button:has(svg)').filter({ hasText: 'Add Staff' })
```

**Scoping — scope a locator inside another element**
```typescript
// Find an anchor inside a nav element (avoids matching same href elsewhere on page)
page.locator('nav a[href="/clinic/settings/frontdesk"]')

// Find Edit button inside a specific staff row
page.locator('div.p-5').filter({ hasText: 'Staff One' }).locator('button[title="Edit"]')
```

**.nth() — when multiple elements match, pick by index (0-based)**
```typescript
page.locator('p.text-sm.font-semibold').nth(0)  // first match
page.locator('p.text-sm.font-semibold').nth(1)  // second match
page.locator('p.text-sm.font-semibold').nth(2)  // third match
```

**.first() — shortcut for nth(0)**
```typescript
page.locator('button[title="Edit"]').first()
```

---

## Chapter 6 — Strict Mode Violation

### What is it?
Playwright has "strict mode" — if a locator matches MORE THAN ONE element, it throws an error:
```
Error: strict mode violation: locator resolved to 5 elements
```

### Why does this happen?
Your locator is not specific enough. Example:
- `a[href="/clinic/settings/frontdesk"]` matches BOTH the nav bar link AND the profile card link
- `button[title="Edit"]` matches ALL Edit buttons on ALL staff rows

### How to fix it — make the locator more specific

Option 1: Scope inside a parent element
```typescript
// WRONG — matches nav link AND card link (2 elements)
page.locator('a[href="/clinic/settings/frontdesk"]')

// CORRECT — scoped to nav, only matches nav link (1 element)
page.locator('nav a[href="/clinic/settings/frontdesk"]')
```

Option 2: Filter by text
```typescript
// WRONG — matches all staff rows that have "Staff One" name
page.locator('div.p-5').filter({ hasText: 'Staff One' }).locator('button[title="Edit"]')
// (matched 5 because "Staff One" was added 5 times in 5 test runs)

// CORRECT — .first() picks one, avoids strict mode error
page.locator('div.p-5').filter({ hasText: 'Staff One' }).locator('button[title="Edit"]').first()
```

Option 3: Use a more unique attribute (title, id, placeholder)

---

## Chapter 7 — Assertions (expect)

Assertions check that something is true. If the check fails, the test fails.

### Most used assertions
```typescript
// Is the element visible on screen?
await expect(locator).toBeVisible();
await expect(locator).not.toBeVisible();

// Does the URL match?
await expect(page).toHaveURL('/clinic/dashboard');
await expect(page).toHaveURL(/clinic\/dashboard/);  // regex — more reliable

// Does the element have exact text?
await expect(locator).toHaveText('Frontdesk Staff');

// Does the element contain this text (partial match)?
await expect(locator).toContainText('staff members');
await expect(locator).toContainText('Dr. Test');
```

### The most important thing: expect() has BUILT-IN RETRY
When you use `expect(locator).something()`, Playwright doesn't check just once.
It keeps retrying every 100ms until the check passes or the timeout is reached.

```typescript
// This keeps polling until the text changes to "10 staff members" or 10s pass
await expect(staffCountText).toContainText('10 staff members', { timeout: 10000 });
```

This is why you should ALWAYS use `expect()` for assertions on dynamic values
that change after API calls — never read the value manually and compare.

```typescript
// WRONG — reads once, no retry, gets stale value
const count = await locator.innerText();
expect(count).toBe('10 staff members');  // fails if API hasn't updated yet

// CORRECT — retries automatically until text matches
await expect(locator).toContainText('10 staff members');
```

---

## Chapter 8 — Waiting Strategies

Playwright is fast. The page or API might not be ready yet. You need to wait.

### waitForURL — wait until the URL changes
```typescript
// Wait until URL contains "clinic/dashboard"
await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });
```

Use this after login — the redirect chain (login → store token → dashboard) takes time.

**Why regex instead of string?**
- String `'**/clinic/dashboard'` — glob pattern, less reliable
- Regex `/clinic\/dashboard/` — partial match, works even if URL has query params

### waitForLoadState — wait for page loading to reach a state
```typescript
await page.waitForLoadState('domcontentloaded');  // HTML parsed
await page.waitForLoadState('networkidle');        // no network requests for 500ms
```

**When does networkidle NOT work?**
React apps fetch data inside `useEffect` which runs AFTER the page is already loaded.
By the time you call `waitForLoadState('networkidle')`, the page is already idle —
the method returns immediately and misses the data fetch entirely.

**Fix: wait for actual DOM proof of data**
```typescript
// Wait for either staff cards (data loaded) OR empty state (no data, but page ready)
await Promise.race([
  page.locator('button[title="Edit"]').first().waitFor({ state: 'visible', timeout: 10000 }),
  page.getByRole('button', { name: 'Add Staff Member' }).waitFor({ state: 'visible', timeout: 10000 }),
]);
```

`Promise.race` — whichever promise finishes first wins. The other is ignored.
This handles BOTH cases: staff exist (Edit button appears) and no staff (empty state appears).

### waitFor on a locator — wait for a specific element
```typescript
await locator.waitFor({ state: 'visible', timeout: 10000 });   // wait for it to appear
await locator.waitFor({ state: 'hidden',  timeout: 10000 });   // wait for it to disappear
```

---

## Chapter 9 — Configuration (playwright.config.ts)

### baseURL
```typescript
baseURL: 'http://localhost:3000'
```
After setting this, you can write `page.goto('/login')` instead of
`page.goto('http://localhost:3000/login')` everywhere.

### workers
```typescript
workers: 1
```
How many tests run at the same time. Set to 1 when tests hit a real database —
running in parallel causes race conditions (two tests writing at the same time).

### dotenv
```typescript
import dotenv from 'dotenv';
dotenv.config();
```
Loads the `.env` file so `process.env.TEST_EMAIL` works in tests.
Credentials stay in `.env` (on your machine only) — never hardcoded in test files.

---

## Chapter 10 — Helper Functions

When multiple tests do the exact same steps, extract them into a helper function.

### Why?
- Write the steps once, use everywhere
- If something changes, fix in one place
- Tests become shorter and easier to read

### Example
```typescript
// Without helper — repeated in every test
test('test 1', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[placeholder="email"]', process.env.TEST_EMAIL!);
  await page.fill('[placeholder="password"]', process.env.TEST_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });
  // ... actual test steps
});

// With helper — clean and reusable
async function loginAndWaitForDashboard(page, loginPage) {
  await loginPage.navigate();
  await loginPage.login(process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
  await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });
}

test('test 1', async ({ page }) => {
  await loginAndWaitForDashboard(page, loginPage);  // one line
  // ... actual test steps
});
```

---

## Chapter 11 — Bugs We Hit and How We Fixed Them

### Bug 1: Forgot Password link failing
**Error:** `getByRole('link', { name: 'Forgot Password?' })` not found
**Cause:** The `?` in the name was treated as a regex special character
**Fix:** Use `locator('a[href="/forgot-password"]')` instead

### Bug 2: Dashboard URL timeout
**Error:** `waitForURL` timed out after 15 seconds
**Cause:** Login flow has a `setTimeout` of 500ms + two redirects — total ~20s on local
**Fix:** Increased timeout to 30000ms and switched from glob to regex pattern

### Bug 3: Staff count reading too fast (got 0)
**Error:** `countBefore` was always 0 even though staff existed in the database
**Cause:** React renders "0 staff members" initially, then fetches from MongoDB.
`waitForLoadState('networkidle')` returned before the useEffect fetch completed.
**Fix:** Use `waitForStaffList()` which waits for actual DOM elements (Edit buttons)

### Bug 4: Staff count after adding not updating (countAfter = countBefore)
**Error:** After adding staff, count read was still the old value
**Cause:** `waitForStaffList()` returned immediately because Edit buttons from EXISTING
staff were already visible — didn't wait for the NEW entry to appear
**Fix:** Use `expect(locator).toContainText(expectedText)` which retries automatically

### Bug 5: Duplicate email — modal never closed
**Error:** Modal stayed open, count never increased
**Cause:** Staff email like `staffone@dermacloud.com` already existed in MongoDB from
a previous test run. API returned "email already exists", modal stayed open with error.
**Fix:** Use `Date.now()` timestamp in email: `` `staffone${Date.now()}@dermacloud.com` ``

### Bug 6: Strict mode violation — 5 elements matched
**Error:** `locator resolved to 5 elements`
**Cause:** Staff name "Staff One" was reused every run — after 5 runs, 5 cards matched
**Fix:** Add `.first()` to the locator — picks one, avoids the violation

### Bug 7: navFrontdesk strict mode on profile page
**Error:** `locator resolved to 2 elements` for `a[href="/clinic/settings/frontdesk"]`
**Cause:** Profile page has the same href in BOTH the nav bar AND the Frontdesk card
**Fix:** Scope the nav link: `nav a[href="/clinic/settings/frontdesk"]`
Use `.filter({ hasText: 'Frontdesk Staff' })` for the card link

---

## Chapter 12 — Key Mindset Shifts (Selenium → Playwright)

| Selenium Java | Playwright TypeScript |
|---|---|
| `driver.findElement(By.id("x"))` | `page.locator('#x')` |
| `element.click()` | `await element.click()` |
| `assertEquals("text", element.getText())` | `await expect(locator).toHaveText('text')` |
| `WebDriverWait` with `ExpectedConditions` | `expect(locator).toBeVisible()` — retries built in |
| `Thread.sleep(2000)` — explicit waits | Never use sleep — use `waitForURL`, `waitFor`, `expect` |
| Separate test runner (TestNG/JUnit) | Playwright has its own built-in test runner |
| Page Factory with `@FindBy` | POM with TypeScript class + constructor |
| `driver.get("http://localhost:3000/login")` | `page.goto('/login')` — baseURL handles the prefix |

**Biggest shift:** In Selenium you fight timing constantly with explicit/implicit waits.
In Playwright, `expect()` assertions retry automatically — trust them and stop adding sleeps.

---

---

## Chapter 13 — globalSetup and storageState (Login Once)

### The Problem: Rate Limiter

When we had 7 form tests, each test did a real UI login (email → password → click Sign In).
After about 3 rapid logins, DermaCloud's API blocked further attempts:

```
"Too many login attempts. Please try again later."
```

Tests 4–7 all timed out waiting for the dashboard because they were stuck on the login page.

### The Solution: Login Once, Save the Token

Playwright has a built-in mechanism for this:

1. **globalSetup** — a special file that runs ONCE before any test file starts
2. **storageState** — saves the browser's localStorage (which holds the auth token) to a JSON file
3. **test.use({ storageState: file })** — loads that JSON file before each test, making the app think you are already logged in

### How It Works — Three Steps

**Step 1: Create global-setup.ts**
```typescript
import { chromium } from '@playwright/test';
import * as fs   from 'fs';
import * as path from 'path';
import dotenv    from 'dotenv';

dotenv.config();  // needed here — runs before playwright.config.ts is processed

async function globalSetup() {
  const authDir = path.join(__dirname, 'playwright/.auth');
  fs.mkdirSync(authDir, { recursive: true });  // create folder if it doesn't exist

  const browser = await chromium.launch();
  const page    = await browser.newPage();

  // Do the real UI login — just ONCE for the entire test run
  await page.goto('http://localhost:3000/login');
  await page.getByPlaceholder('doctor@example.com').fill(process.env.TEST_EMAIL!);
  await page.getByPlaceholder('Enter your password').fill(process.env.TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/clinic\/dashboard/, { timeout: 30000 });

  // Save the entire localStorage to a JSON file
  await page.context().storageState({ path: path.join(authDir, 'user.json') });

  await browser.close();
}

export default globalSetup;
```

**Step 2: Register it in playwright.config.ts**
```typescript
export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  // ... rest of config
});
```

**Step 3: Tell each test describe block to load the token**
```typescript
const AUTH_FILE = 'playwright/.auth/user.json';

test.describe('Form Settings', () => {
  test.use({ storageState: AUTH_FILE });  // loads token before creating the browser context
  // ... tests — app sees the token, treats user as logged in immediately
});
```

### What storageState Actually Does

When a user logs in on DermaCloud:
1. The server returns a JWT (JSON Web Token)
2. The frontend stores it: `localStorage['token'] = 'eyJ...'`
3. Every API request reads this token and adds it to the Authorization header

`storageState` saves a snapshot of localStorage to a JSON file. When a test loads it,
the browser starts with that localStorage already set — the app finds the token, skips
the login page entirely, and loads the dashboard.

### Why globalSetup Must Load dotenv Again

`playwright.config.ts` calls `dotenv.config()` when Playwright reads the config.
But `global-setup.ts` runs BEFORE Playwright processes the config — so the `dotenv.config()`
in `playwright.config.ts` has NOT run yet when globalSetup starts.

That is why `global-setup.ts` needs its own `dotenv.config()` call at the top.

### Files Created

- `global-setup.ts` — runs once, does login, writes the token file
- `playwright/.auth/user.json` — the saved token (added to `.gitignore` — never commit tokens)

---

## Chapter 14 — beforeAll vs beforeEach

### beforeEach — runs before EVERY test

We have used this from the beginning:
```typescript
test.beforeEach(async ({ page }) => {
  dashboardPage = new DashboardPage(page);
  profilePage   = new ProfilePage(page);
  formsPage     = new FormsPage(page);
});
```

Each test gets a fresh `page` from Playwright. We initialize page objects here so every
test starts with a clean state.

### beforeAll — runs ONCE before the first test in the group

```typescript
test.beforeAll(async ({ browser }) => {  // gets 'browser', NOT 'page'
  const context = await browser.newContext({ storageState: AUTH_FILE });
  const page    = await context.newPage();
  // ... do setup once for the whole group
  await context.close();  // YOU must close it — Playwright won't
});
```

**The critical difference: which fixture you get**

- `beforeEach` gets `{ page }` — Playwright creates and manages it
- `beforeAll` gets `{ browser }` — you must create AND close your own context and page

### Why We Need beforeAll for Forms

The form tests modify the database:
- Test 2 disables "Clinical Examination" (restores at end)
- Test 3 disables "Duration" field (restores at end)
- Test 4 changes "Previous Treatment" to Required (restores at end)

Each test restores state — but only if it completes successfully. If a test crashes
mid-save (Part A saved, Part B failed), the database is left dirty:
- Clinical Examination stuck as "Hidden"
- Duration field stuck as disabled
- Previous Treatment stuck as "Required"

The next test run expects the starting state and immediately fails.

**Solution: beforeAll checks and corrects all three before any test runs**

```typescript
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: AUTH_FILE });
  const page    = await context.newPage();
  const fp      = new FormsPage(page);

  await fp.navigate();
  await fp.waitForLoad();

  let needsSave = false;

  // Check 1: Clinical Examination should be Active
  const sectionBadge = await fp.getSectionBadge('Clinical Examination').textContent();
  if (sectionBadge?.includes('Hidden')) {
    await fp.clickSectionToggle('Clinical Examination');
    needsSave = true;
  }

  // Check 2: Duration should be enabled (green toggle)
  const durationClass = await fp.getFieldToggle('Duration').getAttribute('class');
  if (durationClass?.includes('bg-gray-200')) {
    await fp.clickFieldToggle('Duration');
    needsSave = true;
  }

  // Check 3: Previous Treatment should be Optional
  const ptText = await fp.getFieldRequiredPill('Previous Treatment').textContent();
  if (ptText?.includes('Required')) {
    await fp.clickFieldRequiredPill('Previous Treatment');
    needsSave = true;
  }

  // One save call covers all three corrections
  if (needsSave) {
    await fp.clickSaveHeader();
    await expect(fp.getHeaderSaveButton()).toContainText('Saved', { timeout: 10000 });
  }

  await context.close();  // REQUIRED — beforeAll does not auto-close
});
```

### Summary Table

| | beforeEach | beforeAll |
|---|---|---|
| When it runs | Before EVERY test | Once, before the first test |
| Fixture you get | `{ page }` | `{ browser }` |
| Creates its own context? | No — Playwright does it | Yes — you must do it yourself |
| Must close context? | No | Yes — `await context.close()` |
| Best for | Page object setup each test needs | One-time DB state normalization |

---

## Chapter 15 — Five More Bugs (Forms Test Suite)

### Bug 8: Rate limiter blocking tests 4–7

**Error:** "Too many login attempts. Please try again later." — tests 4–7 timed out on the login page.

**Cause:** Every form test did a full UI login. After ~3 rapid logins, the server blocked further attempts.

**Fix:** Created `global-setup.ts` + `storageState`. Login happens once globally. All 7 tests reuse the saved token. See Chapter 13 for full details.

---

### Bug 9: Dirty database state from crashed previous runs

**Error:** Test 2 immediately failed — expected "Active" but got "Hidden" on "Clinical Examination".

**Cause:** A previous test run had crashed mid-test. Part A saved "Hidden" to the DB. Part B (restore to Active) never ran. Database was left dirty.

**Fix:** Added `beforeAll` that checks Clinical Examination, Duration, and Previous Treatment. If any is in the wrong state, it corrects it before tests start. See Chapter 14 for full details.

---

### Bug 10: saveAndConfirm returning too early — the root cause of dirty DB

This was the REAL root cause that caused Bug 9. Understanding this one is important.

**What happened:**

The original save helper waited for a success toast:
```typescript
// ORIGINAL — WRONG
await page.getByText('Form settings saved!').waitFor({ state: 'visible' });
```

The success toast stays visible for 3.5 seconds. Here is the exact failure sequence:

1. Part A of Test 2 saves → toast "Form settings saved!" appears for 3.5s
2. Part B clicks Save → `saveAndConfirm` checks for the toast
3. **Part A's toast is still on screen** → the check passes immediately
4. But Part B's API call has NOT finished yet — it is still in-flight
5. Test ends → browser context closes → the API request is cancelled
6. Database is NOT updated → state is left dirty

**Fix:** Wait for the header button to change back to "Saved" instead of watching the toast.
The button is controlled by `setHasChanges(false)` inside the API's `.then()` success handler —
it only changes AFTER the API call completes. This makes it a reliable completion signal.

```typescript
async function saveAndConfirm(formsPage: FormsPage) {
  await expect(formsPage.getHeaderSaveButton()).toContainText('Save Changes');
  await formsPage.clickSaveHeader();
  // "Saved" text is set by setHasChanges(false) INSIDE the API success handler
  // — only appears after the API call fully completes
  await expect(formsPage.getHeaderSaveButton()).toContainText('Saved', { timeout: 10000 });
}
```

**Key lesson:** The toast is a UI indicator for the USER — it appears fast and stays visible
briefly regardless of the API state. The button state is tied to the actual API completion.
When you need to know if a save truly completed, wait for the UI element that is bound to the
API callback — not the toast.

---

### Bug 11: Strict mode violation — 18 "Remove" buttons

**Error:** `strict mode violation: getByRole('button', { name: 'Remove' }) resolved to 18 elements`

**Cause:** The delete confirmation modal has a "Remove" button. But every field row also has a
trash icon whose `title` attribute says "Remove field". Playwright uses the `title` as the
accessible name for buttons without visible text. The name `'Remove'` without `exact: true`
does **substring matching** — so "Remove field" also matched, giving 18 results.

**Fix:** Add `exact: true` to require an exact accessible name match:

```typescript
// WRONG — "Remove" is a substring of "Remove field", so all 18 trash icons match
page.getByRole('button', { name: 'Remove' })

// CORRECT — accessible name must be exactly "Remove" (only the confirm modal button)
page.getByRole('button', { name: 'Remove', exact: true })
```

**When to use `exact: true`:** Any time you have buttons where one name is a substring of
another. Common pattern: action buttons ("Remove", "Edit") vs labelled icon buttons
("Remove field", "Edit staff") on the same page.

---

### Bug 12: Cleanup locator matched the toast instead of the field row

**Error:** Test 6's cleanup loop found "Skin Texture Test" text, tried to click "Remove field"
inside that element, waited 30 seconds → timeout.

**Root cause — two parts:**

**Part 1: CSS class collision.** The success toast div and the field row divs share the EXACT
same Tailwind CSS classes: `flex items-center gap-3 px-5 py-3.5`. The cleanup locator:
```typescript
div.flex.items-center.gap-3.px-5 [hasText: 'Skin Texture Test']
```
...matched the toast when it was on screen, because the toast showed `"Skin Texture Test" removed`.
The toast has no "Remove field" button inside it → waited forever.

**Part 2: Cleanup was in beforeAll.** The toast appears after a save from a previous run.
`beforeAll` ran immediately, found the toast, matched it as a "field row", failed.

**Fix:** Moved cleanup INTO Test 6 itself. Scoped the locator to the section card container.
The toast is `position: fixed` and lives outside all section cards in the DOM:

```typescript
// Scope to the Clinical Examination section card (div.bg-white.rounded-2xl)
// The toast is position:fixed — it is OUTSIDE all section cards
const ceCard = page.locator('div.bg-white.rounded-2xl')
  .filter({ has: page.locator('h3').filter({ hasText: 'Clinical Examination' }) });

const leftoverRows = ceCard
  .locator('div.flex.items-center.gap-3.px-5')
  .filter({ hasText: customFieldLabel });

while (await leftoverRows.count() > 0) {
  await leftoverRows.first().locator('button[title="Remove field"]').click({ force: true });
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByText(`"${customFieldLabel}" removed`).waitFor({ state: 'visible', timeout: 5000 });
}
```

**Two new Playwright techniques used here:**

`locator.count()` — returns the current number of matching elements in the DOM without waiting.
This is the correct way to check "does this element exist right now?" in a while loop.
Using `expect(locator).toHaveCount(0)` would also work but it waits — `count()` is instant.

`{ force: true }` on `.click()` — bypasses Playwright's actionability checks.
Normally Playwright waits for an element to be visible, stable, and not covered before clicking.
`force: true` skips these checks. Used here because the React re-render after `beforeAll`
corrects state may still be in progress when the loop starts.

---

---

## Chapter 16 — Playwright's Error Message Tells You the Real Answer

When an assertion fails, Playwright's error output shows you **exactly what the DOM contains**.
You never have to guess — the fix is right there in the failure message.

### Example from our Cosmetology test

We guessed the Cosmetology selected card used `border-violet-500` (because the card looks purple/violet). The test failed with:

```
Expected pattern: /border-violet-500/
Received string:  "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left border-purple-500 bg-purple-50"
```

`Received string` is the **actual class list of the element in the live browser**. It told us clearly: the class is `border-purple-500`, not `border-violet-500`. One word change fixed the test.

### Rule: always read `Received string` first

```
Expected pattern: /your-guess/
Received string:  "the actual value"  ← this is the truth
```

- **Expected** = what your test asked for
- **Received** = what the browser actually has

If they don't match, change your test to match the Received value (assuming the app behaviour is correct). This is faster than opening DevTools.

---

## Chapter 17 — Screenshot and error-context.md as a Debugging Tool

Every time a Playwright test fails, it saves two files inside `test-results/`:

```
test-results/
└── <test-name-folder>/
    ├── test-failed-1.png    ← screenshot at the moment of failure
    └── error-context.md     ← full YAML DOM snapshot + error details
```

### test-failed-1.png — see the page at failure time

The screenshot shows **exactly what the browser looked like** when the assertion threw. This immediately answers:
- Did the page load at all?
- Which tab was selected?
- Was the right modal open?
- What text was visible?

In our case: the first run failed because we used Dermatology field names for Cosmetology. The screenshot showed the Cosmetology tab was selected and all five real sections were visible — `Assessment & Analysis`, `Procedure Details`, `Aftercare & Follow-up`, `Consent & Risks`, `Patient Information`. Without the screenshot we would have had to guess.

### error-context.md — the full DOM in YAML

This file contains a YAML tree of every element on the page at the moment of failure:
```yaml
- heading "Assessment & Analysis" [level=3]
- heading "Procedure Details" [level=3]
- button "Optional" [cursor=pointer]
- button "Required" [cursor=pointer]
```

From this we got the exact section names and field names for Cosmetology without running the app ourselves. This is more reliable than guessing because it's the live DOM, not our assumptions.

### How to use them

After a failure:
1. Open `test-results/` in your file explorer
2. Look at the PNG first — understand the page state visually
3. Read the YAML in `error-context.md` if you need exact element names or text values
4. Fix the test using what you found — no DevTools needed

---

## Chapter 18 — Different Tabs, Different CSS Themes

The Form Settings page has two form-type cards: **Dermatology** and **Cosmetology**. Each card uses its own color theme.

| Form type | Selected border class | Background class |
|---|---|---|
| Dermatology | `border-teal-500` | (teal theme) |
| Cosmetology | `border-purple-500` | `bg-purple-50` |

### Why this matters for assertions

When you switch from one form type to the other, the selected card changes. You cannot
assume both cards use the same CSS class when selected:

```typescript
// Dermatology test — Dermatology card is selected
await expect(formsPage.getDermatologyButton()).toHaveClass(/border-teal-500/);

// Cosmetology test — Cosmetology card is selected (DIFFERENT class)
await expect(formsPage.getCosmetologyButton()).toHaveClass(/border-purple-500/);
```

### How we found the Cosmetology class

We assumed `border-violet-500` (visually the card looked violet-ish). The test failed and
Playwright's `Received string` showed `border-purple-500`. One correction, test passed.

**Takeaway:** whenever you assert on a CSS class for a new element, run the test once.
If it fails, Playwright's received string gives you the correct class. It's faster than
inspecting the app in DevTools.

---

## Chapter 19 — Switching Form Types and Waiting for the New Sections

When the user clicks the Cosmetology button, the page makes a new API request and
re-renders the sections. If you click the button and immediately try to read a section
badge, you might read stale Dermatology data (still in the DOM while Cosmetology loads).

### The fix: waitForCosmetologyLoad()

We added a dedicated method to `FormsPage` that waits for sections to stabilize after
the tab switch:

```typescript
async waitForCosmetologyLoad() {
  await this.page
    .locator('h3')
    .filter({ hasText: 'Patient Information' })
    .waitFor({ state: 'visible', timeout: 15000 });
}
```

`Patient Information` is the anchor we wait for — it exists in both form types.
When switching, the old sections briefly disappear (loading state = true) and then
Cosmetology sections appear. Waiting for this h3 ensures Cosmetology data is rendered.

### Why a separate method (not just reusing waitForLoad)?

`waitForLoad()` and `waitForCosmetologyLoad()` do the same thing today. But they are
two separate methods because:

- If the Cosmetology form ever changes its sections (e.g. `Patient Information` is renamed),
  we update **one method** (`waitForCosmetologyLoad`) without touching the Dermatology flow
- The intent is clear — the method name tells the reader WHY it is called here

### The pattern for every tab-switch

```typescript
async function goToCosmForms(page, formsPage) {
  await formsPage.navigate();           // 1. go to the page (Dermatology loads by default)
  await formsPage.selectCosmetology();  // 2. click Cosmetology tab
  await formsPage.waitForCosmetologyLoad(); // 3. wait for Cosmetology sections to render
}
```

---

## Chapter 20 — beforeAll Must Switch Form Type Before Reading State

The `beforeAll` normalizer in `cosmetology-forms.spec.ts` must switch to Cosmetology
**before** it reads any section badge or field toggle. Without this, it reads the
Dermatology state and "fixes" the wrong form.

```typescript
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: AUTH_FILE });
  const page    = await context.newPage();
  const fp      = new FormsPage(page);

  await fp.navigate();
  await fp.selectCosmetology();       // ← MUST be first
  await fp.waitForCosmetologyLoad();  // ← then wait

  // Only now is it safe to read Cosmetology-specific badges and toggles
  const sectionBadge = await fp.getSectionBadge('Assessment & Analysis').textContent();
  ...
});
```

### What goes wrong without the switch

- `fp.navigate()` loads the page with **Dermatology** selected (the default)
- `fp.getSectionBadge('Assessment & Analysis')` looks for a section called "Assessment & Analysis"
- That section does not exist in Dermatology — Playwright waits and times out after 30 seconds
- All 7 tests are skipped with "beforeAll hook timeout"

This is exactly the error we hit in our first run. The fix: three lines — navigate, click Cosmetology, wait for load — before any state reads.

---

## Chapter 21 — Edit Staff Session: Four New Lessons

This chapter covers everything learned while writing and debugging `frontdesk-edit.spec.ts`.
Four distinct problems were hit, each teaching something new about Playwright locator strategy.

---

### Lesson 1: Modal heading text is not always what you expect — verify by running

**What happened:**
We assumed the edit modal heading was `"Edit Frontdesk Staff"` to match the Add modal pattern `"Add Frontdesk Staff"`.
The test failed immediately at step 4 with "element(s) not found".

**The failure screenshot showed:**
The modal was open and working perfectly — heading was just `"Edit Staff"`.

**Key rule:**
The add modal and edit modal can be completely different React components with different heading text, different field labels, different placeholder text, and different submit button labels.
Never assume the edit version mirrors the add version.

**How to find the real text:**
Run the test once, let it fail, read the failure screenshot — the heading is plainly visible.
This is faster than opening DevTools.

```typescript
// WRONG — assumed
page.locator('h3').filter({ hasText: 'Edit Frontdesk Staff' })

// CORRECT — confirmed from screenshot
page.locator('h3').filter({ hasText: 'Edit Staff' })
```

---

### Lesson 2: `getByLabel` requires a real label–input link — siblings don't count

**What happened:**
The edit modal showed "FULL NAME *" and "PHONE *" labels visually (because of CSS `text-transform: uppercase`).
We tried `page.getByLabel('FULL NAME', { exact: false })`.
The test failed with "element(s) not found".

**Why `getByLabel` failed — the DOM structure:**
```html
<div>
  <label>Full Name *</label>      ← label and input are SIBLINGS inside a div
  <input type="text" value="..."> ← no `id` attribute
</div>
```

`getByLabel` only works when the label and input are **linked** via one of these:
```html
<!-- Option A: explicit for/id linking -->
<label for="nameInput">Full Name</label>
<input id="nameInput" type="text">

<!-- Option B: input nested INSIDE label -->
<label>Full Name <input type="text"></label>
```

In this app, labels are just adjacent `<div>` siblings with no `for`, no `id`, no nesting.
Playwright cannot figure out which input belongs to which label — so it finds nothing.

**Second problem — CSS text-transform:**
The label looks `UPPERCASE` on screen because of `text-transform: uppercase` CSS.
But the actual HTML text is `"Full Name *"` (mixed case).
`getByLabel('FULL NAME')` fails even if the link existed — the case doesn't match the real text.

**Rule:** `getByLabel` requires explicit HTML association. When that's missing, use a different strategy.

---

### Lesson 3: `getByPlaceholder` only works when a placeholder attribute exists

**What happened:**
The Add modal's name input uses `placeholder="Staff member name"`.
So we assumed the Edit modal's name input also has that placeholder.
`getByPlaceholder('Staff member name')` returned "element(s) not found" in the edit modal.

**Why:**
When a React form component renders in "edit mode", it pre-fills the inputs with existing values from the DB.
The developer may simply never set a `placeholder` attribute on edit inputs — the value is already there, so placeholder text is not needed.

**The real input HTML in the edit form (from DevTools):**
```html
<input type="text" value="Staff Three">         ← no placeholder attribute at all
<input type="tel" value="9876543212">           ← no placeholder attribute at all
<input type="password" placeholder="Enter new password">  ← only the password has one
```

**The fix — use `input[type]` scoped to the form:**
Since each input type appears exactly once in the form, this is both unique and stable:
```typescript
page.locator('form input[type="text"]')   // Full Name
page.locator('form input[type="tel"]')    // Phone
```

**What "scoped to form" means:**
`form input[type="text"]` tells Playwright:
"find an `input[type=text]` that lives inside a `<form>` element."
The modal has a `<form>`. The staff list page does not.
So only the modal's inputs match — no accidental matches from the background page.

**Rule of thumb for locator strategy priority:**
1. `getByRole` — semantic, best for buttons/links/headings
2. `getByPlaceholder` — best for empty input fields
3. `getByLabel` — only when label has `for`/`id` link or wraps the input
4. `input[type]` scoped to a container — when pre-filled inputs have no placeholder and no label link
5. `nth(n)` — last resort when nothing else distinguishes them

---

### Lesson 4: `"element(s) not found"` vs `"Expected: visible"` — they mean different things

Two different Playwright failure messages look similar but have completely different causes:

**Message A: `Error: element(s) not found`**
```
Error: expect(locator).toBeVisible() failed
Locator: getByText('Staff updated successfully!')
Error: element(s) not found
```
Means: Playwright searched the entire DOM and could not find ANY element matching the locator.
The element was never in the DOM during the timeout window.

**Message B: `Expected: visible` (without "not found")**
```
Error: expect(locator).toBeVisible() failed
Expected: visible
Received: hidden
```
Means: Playwright FOUND the element but it exists in the DOM as hidden (`display: none`, `visibility: hidden`, `opacity: 0`).

**Why this matters for debugging:**
- "not found" → the locator is wrong, OR the action that should create the element never fired
- "hidden" → the locator is correct, the element exists but is intentionally not shown

In our case: `"Staff updated successfully!"` toast gave "not found" — the API just hadn't responded in 5 seconds yet. The toast appeared right after the timeout.

---

### Lesson 5: Use 10000ms timeout for toasts after PUT/POST API calls

**What happened:**
```typescript
await expect(frontdeskPage.getStaffUpdatedToast()).toBeVisible({ timeout: 5000 });
// Failed: "element(s) not found" — but screenshot showed toast was there
```

The failure screenshot (taken at the failure moment) showed "Staff updated successfully!" was visible.
This means the toast appeared JUST AFTER the 5 second window expired.

**Why the toast is slow:**
The toast only appears AFTER the API call completes. PUT/POST requests (which write to MongoDB) are slower than GET requests (which only read). 5 seconds is not always enough for a write operation under load.

**The auto-dismiss timing is separate:**
The toast starts its 4-second dismiss timer when it APPEARS — not when we start waiting.
So even with a 10 second wait:
1. API takes 7 seconds → toast appears
2. We catch it within 10 seconds ✅
3. Toast then stays for 4 more seconds → we have 4 full seconds to assert ✅

**Rule:**
- Read-only API calls (loading pages, fetching lists): 5000ms is usually fine
- Write API calls (save, create, update, delete): use 10000ms for the completion signal

```typescript
// Reading data — 5000ms is fine
await expect(frontdeskPage.getEditButtonForStaff(name)).toBeVisible({ timeout: 5000 });

// After a write API call — use 10000ms
await expect(frontdeskPage.getStaffUpdatedToast()).toBeVisible({ timeout: 10000 });
```

---

### New Bugs from This Session

#### Bug 15: Edit modal heading mismatch
**Error:** `locator('h3').filter({ hasText: 'Edit Frontdesk Staff' })` — element not found
**Cause:** Edit modal heading is `"Edit Staff"`, not `"Edit Frontdesk Staff"`
**Fix:** Read the failure screenshot → update heading text to `"Edit Staff"`

#### Bug 16: `getByLabel` fails on labels without `for`/`id`
**Error:** `getByLabel('FULL NAME')` — element not found
**Cause:** The edit form's `<label>` tags have no `for` attribute and inputs have no `id` — Playwright can't associate them. Also the label HTML text is "Full Name *" not "FULL NAME *" (CSS makes it uppercase visually).
**Fix:** Use `page.locator('form input[type="text"]')` for name, `form input[type="tel"]` for phone

#### Bug 17: `getByPlaceholder` fails on pre-filled edit inputs
**Error:** `getByPlaceholder('Staff member name')` — element not found in edit modal
**Cause:** The edit modal's name input is pre-filled from the DB and has NO `placeholder` attribute — the developer never set one for edit mode
**Fix:** Same as Bug 16 — use `input[type]` scoped to `form`

#### Bug 18: Toast timeout too short for edit API
**Error:** `getByText('Staff updated successfully!')` — not found within 5000ms; screenshot showed it appearing just after
**Cause:** The PUT API call (updating staff in MongoDB) took longer than 5 seconds
**Fix:** Increase toast timeout to `{ timeout: 10000 }` for write operations

---

## Chapter 22 — Frontdesk Portal: localStorage Auth vs Cookie Auth

This chapter covers everything about why the frontdesk portal is architecturally
different from the clinic admin portal — and what that means for Playwright tests.

---

### 1. Why this portal is different

The DermaCloud application has two separate authenticated portals:

- `/login` — the **clinic admin / doctor portal**
- `/frontdesk/login` — the **frontdesk staff portal**

They look similar but store auth in completely different ways.

When a frontdesk staff member logs in, the app stores two values in `localStorage`:

```typescript
// From DermaCloud/app/frontdesk/login/page.tsx (the source component)
localStorage.setItem('frontdeskToken', token);
localStorage.setItem('frontdeskStaff', JSON.stringify(staff));
```

Compare this to the clinic admin portal, which stores the JWT in an **HttpOnly cookie**
set by the server. You cannot read an HttpOnly cookie from JavaScript —
`document.cookie` does not show it. The browser sends it automatically on every
request, which is why it is the more secure choice for admin sessions.

The frontdesk portal chose `localStorage` instead. This is visible in the app code
and is the root cause of every decision in this chapter.

---

### 2. Why storageState doesn't work here

In Selenium Java you would typically store session cookies in a browser profile or
pass them via `ChromeOptions`. Playwright's equivalent is `storageState`.

When `storageState` serialises a browser context, it writes a JSON file like this:

```json
{
  "cookies": [
    { "name": "next-auth.session-token", "value": "...", "domain": "localhost", ... }
  ],
  "origins": [
    {
      "origin": "http://localhost:3000",
      "localStorage": []
    }
  ]
}
```

Notice two things:
1. The `cookies` array captures the clinic admin's auth cookie — that is what lets
   `test.use({ storageState: AUTH_FILE })` work for forms tests, frontdesk-edit, etc.
2. The `origins[].localStorage` array is written by `storageState` — but it only
   captures what was in localStorage AT THE MOMENT `storageState()` was called in
   `global-setup.ts`. At that point we logged in as the clinic admin. There is no
   `frontdeskToken` or `frontdeskStaff` key in localStorage at that moment.

So `playwright/.auth/user.json` is completely useless for frontdesk tests.
Loading it would give you the clinic admin cookie but zero frontdesk auth.

**The bottom line:** storageState is the right tool when auth is in cookies or
sessionStorage. It is the wrong tool when auth is in localStorage keys that were
never written during global setup.

---

### 3. What we did instead — real UI login for login tests

For the three tests in `frontdesk-portal-login.spec.ts`, we go through the real
login UI every time:

```typescript
test.beforeEach(async ({ page }) => {
  loginPage     = new FrontdeskLoginPage(page);
  dashboardPage = new FrontdeskDashboardPage(page);
  // No storageState here — frontdesk auth lives in localStorage, not cookies
});

test('Successful login', async ({ page }) => {
  await loginPage.navigate();
  await loginPage.login(process.env.FRONTDESK_EMAIL!, process.env.FRONTDESK_PASSWORD!);
  await page.waitForURL(/frontdesk\/dashboard/, { timeout: 30000 });
  await dashboardPage.waitForLoad();
  await expect(dashboardPage.getWelcomeHeading()).toBeVisible();
});
```

This is the correct approach here because these tests ARE testing the login UI.
Going through the real flow is the point of the test.

**Is there a rate-limiter problem like the clinic admin portal?**
Not really. The clinic admin login blocks at approximately 3 rapid attempts, which is
why `global-setup.ts` + `storageState` was essential for the 7 form tests. The
frontdesk login endpoint allows up to 10 attempts per 15 minutes per IP — generous
enough for 3 login tests to run back-to-back without hitting any limit.

---

### 4. The addInitScript solution for future non-login tests

Once we start writing dashboard content tests, nav tab tests, appointment tests, etc.,
we do not want to go through the real login UI for every test — that would be slow
and would make every test depend on the login flow working correctly.

The solution is `page.addInitScript()`. This method registers a JavaScript function
that Playwright injects into the browser context and runs BEFORE any page script
executes. When React mounts, it already finds `frontdeskToken` and `frontdeskStaff`
in localStorage — it never knows the test skipped the login page.

**The planned pattern:**

```typescript
// ── In beforeAll ──────────────────────────────────────────────────────────────
// Do ONE real API login to capture the tokens
// (This is a direct API call — no browser involved — so no rate limit concern)
test.beforeAll(async ({ request }) => {
  const response = await request.post('/api/auth/frontdesk/login', {
    data: {
      email:    process.env.FRONTDESK_EMAIL!,
      password: process.env.FRONTDESK_PASSWORD!,
    }
  });
  const { token, staff } = (await response.json()).data;
  frontdeskToken = token;
  frontdeskStaff = staff;
});

// ── In beforeEach ─────────────────────────────────────────────────────────────
// Inject tokens into localStorage BEFORE the page navigates
test.beforeEach(async ({ page }) => {
  // addInitScript must be called BEFORE page.goto() — see note below
  await page.addInitScript(({ token, staff }) => {
    localStorage.setItem('frontdeskToken', token);
    localStorage.setItem('frontdeskStaff', JSON.stringify(staff));
  }, { token: frontdeskToken, staff: frontdeskStaff });

  // Now navigate — the page scripts run AFTER the init script, so they find the tokens
  await page.goto('/frontdesk/dashboard');
});
```

**Why `addInitScript` must be called BEFORE `page.goto()`:**

This is different from how you might think it works. `addInitScript` does not run
your function right now — it registers it to run at the start of every page navigation.
The sequence is:

1. `page.addInitScript(fn)` — registers the function (nothing happens in browser yet)
2. `page.goto('/frontdesk/dashboard')` — browser navigates
3. Before any page scripts run, Playwright executes the registered init script
4. `localStorage.setItem(...)` writes the tokens
5. React mounts, reads localStorage, finds the tokens, renders the authenticated dashboard

If you call `page.goto()` first:
1. Browser navigates
2. React runs immediately — reads localStorage — finds nothing
3. React redirects to `/frontdesk/login`
4. Then your `addInitScript` callback runs — too late, React already decided the user is not logged in

In Selenium Java terms: `addInitScript` is like injecting a script tag at the top of
the `<head>` before any other script. `page.goto()` first is like loading the full
page and then trying to run a script after `DOMContentLoaded` — the app already ran.

---

### 5. Summary comparison table

| | Clinic admin portal | Frontdesk portal |
|---|---|---|
| Auth stored in | Cookie (HttpOnly) | `localStorage` |
| `storageState` works? | Yes | No |
| Skip-login trick | `test.use({ storageState: AUTH_FILE })` | `page.addInitScript()` with token injection |
| Rate limit concern | Yes (~3 rapid logins blocked) | Less strict (10 per 15 min) |
| Login test approach | Real UI (`logout.spec.ts`, `login.spec.ts`) | Real UI (`frontdesk-portal-login.spec.ts`) |

**Rule of thumb:** whenever you encounter a new portal or sub-app, check WHERE it stores
auth before writing a single test. Open DevTools → Application → Cookies vs Local Storage.
That one check determines your entire test strategy.

---

---

## Chapter 23 — Booking Workflow: Debounce, Async Slots, and Multi-Page Tests

This chapter covers everything learned writing `frontdesk-book-appointment.spec.ts` —
a single test that spans four pages and introduces three new async timing problems.

---

### 1. Unique test data across runs — the phone number strategy

The add patient API rejects duplicate phone numbers with a 400-level error. If you
hardcode a phone number, the second test run tries to add the same patient and the
modal never closes. The fix is to generate a phone number that changes every run.

```typescript
const ts    = Date.now();                       // epoch ms — changes every millisecond
const phone = `9${String(ts).slice(-9)}`;       // "9" + last 9 digits = 10-digit Indian mobile
const name  = `E2E Patient ${ts}`;             // name is also unique — helps identify test records
```

**Why `"9" + last 9 digits`?**
- `Date.now()` returns a 13-digit number like `1746123456789`
- Taking the last 9 digits gives `123456789` (9 digits)
- Prepending `"9"` gives `9123456789` — exactly 10 digits, starts with 9 (valid Indian mobile)
- The phone format check (`pattern="[0-9]{10}"`) passes
- Different milliseconds = different last 9 digits = no duplicate

**When NOT to use name for search:** In the booking modal, we search by phone instead of
name. The name contains a timestamp but search is fuzzy — it would match all patients
whose name contains a number. Phone is exact: only one patient has that phone.

---

### 2. Search with a debounce — separate typePatientSearch() from selectPatient()

The booking modal's patient search fires the API request 400ms AFTER the user stops
typing. This is a React `useEffect` with a `setTimeout`:

```typescript
// From appointments/page.tsx (simplified)
useEffect(() => {
  const timer = setTimeout(() => {
    if (phoneQuery && !selectedPatient) {
      searchPatientsByPhone(phoneQuery);
    }
  }, 400);
  return () => clearTimeout(timer); // cancel if query changes before 400ms
}, [phoneQuery]);
```

**The problem:** if you fill the input and immediately try to click a result, nothing
is in the DOM yet. The 400ms hasn't elapsed.

**The solution — split into two separate POM methods:**

```typescript
// Step 1: fill the input (returns immediately)
async typePatientSearch(query: string) {
  await this.patientSearchInput.fill(query);
}

// Step 2: wait for the result and click it (handles the debounce + API wait)
async selectPatient(name: string) {
  const result = this.patientResultsList
    .locator('button[type="button"]')
    .filter({ hasText: name });
  await result.waitFor({ state: 'visible', timeout: 10000 }); // waits for debounce + API
  await result.click();
}
```

**Why `waitFor` instead of waiting in `typePatientSearch`?**
Adding a `page.waitForTimeout(400)` in `typePatientSearch` would work but is fragile —
slow CI machines might need longer. `waitFor({ state: 'visible', timeout: 10000 })`
is much better: it retries the DOM check every ~100ms and passes the moment the result
appears, whether that's 500ms or 2000ms. Never hardcode a sleep for debounce delays.

---

### 3. Async slot loading — wait for the grid, filter by availability

Time slots are loaded from `/api/tier2/appointments/slots?date=...` when the booking
modal opens. The grid is not in the DOM until the API responds.

**The problem:** clicking immediately after the modal opens hits an empty DOM.

**The fix — wait for the grid container, then filter for available slots:**

```typescript
async clickFirstAvailableSlot() {
  // Wait for the slot grid to appear (API has responded)
  await this.timeSlotsGrid.waitFor({ state: 'visible', timeout: 15000 });

  // Available slot = button WITHOUT a span.line-through inside it
  // Booked slots have strikethrough text; available ones do not
  const firstAvailable = this.timeSlotsGrid
    .locator('button[type="button"]')
    .filter({ hasNot: this.page.locator('span.line-through') })
    .first();

  await firstAvailable.waitFor({ state: 'visible', timeout: 10000 });
  await firstAvailable.click();
}
```

**What `filter({ hasNot: locator })` does:**
`.filter({ hasNot: ... })` keeps only elements that do NOT contain a matching child.
This is the inverse of `.filter({ has: ... })`. Here we want slots that do NOT have
a `<span class="line-through">` inside them — those are the available ones.

**Why 15000ms for the grid?** The first modal open triggers two API calls:
one for settings (clinic start/end hours) and one for the slots themselves. On cold
MongoDB connections both can take several seconds. 15 seconds is generous but prevents
false failures on slow CI/dev machines.

---

### 4. Multi-page workflow tests — one test, four pages

The booking workflow test navigates across four pages: login → dashboard → patients →
appointments. Each navigation needs its own `waitForURL()` + `waitForLoad()` or the
test can race ahead before the page renders.

**Pattern used for every navigation:**

```typescript
// Navigate via a UI click (not page.goto — we're testing the real flow)
await dashboardPage.goToPatients();

// 1. Wait for the URL to change (confirms navigation happened)
await page.waitForURL(/frontdesk\/patients/, { timeout: 30000 });

// 2. Wait for the page content to load (confirms React rendered the page)
await patientsPage.waitForLoad();

// 3. Assert the right page loaded (fail fast if something went wrong)
await expect(patientsPage.getPageHeading()).toHaveText('Patients');
```

**Why three steps instead of one?**
- `waitForURL` confirms the router completed the navigation
- `waitForLoad` confirms React finished mounting the new page's content
- `expect(heading).toHaveText(...)` confirms the correct page loaded (catches wrong redirects)

Skipping any step is risky. The URL can change before React renders. React can render
before the auth check completes (which might redirect to login). The heading assertion
is the final safety net.

---

### 5. Toast disappears in 4s — why timing still works

The success toast auto-dismisses after 4000ms. The workflow test waits for toasts
twice: once after adding a patient and once after confirming the booking. Between
these two events the test navigates to a new page — which unmounts the toast DOM
completely. There is no risk of the first toast being confused with the second.

But even within the same page, the timing is safe:

```
Timeline:
  t=0       confirmAndWaitForToast() clicks the submit button
  t=6000    API responds (MongoDB write) → toast appears
  t=6000    waitFor() catches the toast (within 10000ms timeout)
  t=10000   toast auto-dismisses
```

The `waitFor({ state: 'visible', timeout: 10000 })` catches the toast the moment it
appears. Then `expect(successToast).toBeVisible()` asserts while it is still visible.
The 4000ms dismiss window is more than enough time to run two Playwright assertions.

**Key lesson:** the toast timeout in `waitFor` is the time Playwright waits for the
toast to APPEAR — not the window to catch it. As long as the toast appears before the
timeout, you have 4 full seconds to assert on it.

---

---

## Chapter 24 — waitForResponse: the right way to wait for search results

This chapter covers the final bug in the booking workflow: an intermittent failure where
the patient search results never appeared even though `pressSequentially` was used.

---

### The symptom

The test failed at `selectPatient()` with a 15-second timeout. The page snapshot showed:
- ✅ The search input had the correct value (`9449043478`) — React state WAS updated
- ❌ No results list (`div.max-h-48`) in the DOM
- ❌ No "No patient found" message

The absence of both signals means `hasSearched` was still `false` in React state —
which only happens if `searchPatientsByPhone()` was never called.

---

### Why was the search function not called?

The React debounce looked correct:

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    if (phoneQuery && !selectedPatient) {
      searchPatientsByPhone(phoneQuery);   // fires 400ms after last keystroke
    }
  }, 400);
  return () => clearTimeout(timer);
}, [phoneQuery, selectedPatient]);
```

`phoneQuery` WAS `"9449043478"` (confirmed from the snapshot). The debounce should have
fired 400ms after the last character. But the failure was intermittent — it worked in one
run and failed in another.

**Root cause:** a timing gap between when `pressSequentially` completed and when `selectPatient`
started the 15-second `waitFor` clock. React 18 concurrent mode can defer state updates
and useEffect scheduling. In slower CI environments or after a cold MongoDB connection,
the entire chain (debounce → API call → response → React re-render) can take more time
than you expect — AND if the `waitFor` clock started slightly before the results rendered,
combined with a slow API, you hit the edge of the window.

The real problem: the test had no reliable signal for "the search is complete."
`waitFor` on a button polls the DOM, but it starts counting immediately, meaning
you're betting on both the debounce AND the API response fitting inside 15 seconds.

---

### The fix: waitForResponse — wait for the network, not the DOM

Instead of polling the DOM for 15 seconds hoping results appear, register a network
listener BEFORE typing, then await it AFTER typing. This is Playwright's built-in tool
for exactly this pattern:

```typescript
async typePatientSearch(query: string) {
  await this.patientSearchInput.click();

  // Set up the listener BEFORE typing — so we never miss a fast response
  const searchApiDone = this.page.waitForResponse(
    resp =>
      resp.url().includes('/api/tier2/patients/list') &&
      resp.request().method() === 'GET',
    { timeout: 15000 },
  );

  await this.patientSearchInput.pressSequentially(query, { delay: 80 });

  // BLOCKS here until: debounce fires → API is called → response arrives
  await searchApiDone;
}
```

The timeline is now:
```
typePatientSearch() starts
  ↓  click input
  ↓  register network listener (listening NOW)
  ↓  pressSequentially: types 10 chars × 80ms = 800ms
  ↓  400ms debounce fires → fetch('/api/tier2/patients/list?search=...')
  ↓  API responds with patient data → searchApiDone resolves
typePatientSearch() returns  ← results are IN THE DOM at this point

selectPatient() starts
  ↓  button[type="button"] with name text is already visible
  ↓  waitFor(5000ms) passes almost instantly
  ↓  click the patient
selectPatient() returns
```

Because `typePatientSearch()` blocks until the API response arrives, `selectPatient()`
can use a short timeout (5000ms). The results are already there.

---

### Why register the listener BEFORE typing?

You must set up `waitForResponse` before the action that triggers the network call —
not after. If you set it up after `pressSequentially`, the API call could already have
fired and resolved before your listener is registered, and you'd wait forever.

Playwright's `waitForResponse` captures responses that happen AFTER the listener is
created. Set it up first, trigger the action, then await the promise.

```typescript
// ✅ Correct — listener registered before the action
const done = page.waitForResponse(url => url.includes('/api/search'));
await input.pressSequentially(query);
await done;

// ❌ Wrong — response might arrive before the listener
await input.pressSequentially(query);
const done = page.waitForResponse(url => url.includes('/api/search'));
await done; // might hang forever
```

---

### waitForResponse vs waitFor — when to use which

| Situation | Use |
|-----------|-----|
| Waiting for a DOM element to appear | `locator.waitFor({ state: 'visible' })` |
| Waiting for an API call to complete | `page.waitForResponse(urlMatcher)` |
| Waiting for a page navigation | `page.waitForURL(pattern)` |
| Waiting for multiple things in parallel | `Promise.all([...])` |

`waitForResponse` is the correct tool when:
- A user action triggers a network request
- The DOM change (results appearing) depends on the network response
- The timing between action and DOM change is variable (debounce + network)

Use `waitFor` on a locator when:
- The DOM change is triggered by something deterministic you just did
- You already know the network call has completed (e.g., after `waitForResponse`)

---

### The pressSequentially delay: 50ms → 80ms

The delay was also increased from 50ms to 80ms per character. With 50ms between
keystrokes, React 18 in concurrent mode sometimes batches state updates from adjacent
keystrokes — the `phoneQuery` state might jump multiple characters at once instead of
updating one at a time. At 80ms, each character's `onChange` has time to be processed
and committed before the next one fires.

This is not a fix in isolation — the real fix is `waitForResponse`. But 80ms is
a safer default for typing into React controlled inputs.

---

## Summary of Everything Covered

1. Project setup — Node.js, npm, Playwright install
2. TypeScript basics — async/await, interfaces, template literals, process.env
3. Test structure — describe, beforeEach, test()
4. Page Object Model — why it exists, how to build one
5. Locators — 7 ways to find elements, how to narrow them down
6. Strict mode violation — what causes it, 3 ways to fix it
7. Assertions — toBeVisible, toHaveURL, toHaveText, toContainText, built-in retry
8. Waiting strategies — waitForURL, waitForLoadState, waitFor, Promise.race
9. Why networkidle fails for React useEffect data fetches
10. playwright.config.ts — baseURL, workers, dotenv, timeouts
11. Helper functions — when and why to extract them
12. Real bugs encountered and fixed during actual test writing
13. globalSetup and storageState — login once, bypass rate limiters, save auth token
14. beforeAll vs beforeEach — when to use each, browser vs page fixture, closing contexts
15. Five more bugs — race with toast, API completion signal, exact:true, CSS collision, count() loops
16. Playwright error messages — what `Received string` tells you, how to use it to fix tests instantly
17. Screenshot and error-context.md as a debugging tool — reading screenshots beats guessing
18. Different tabs, different CSS themes — Dermatology teal vs Cosmetology purple
19. Switching form types — waitForCosmetologyLoad() prevents reading stale Dermatology data
20. beforeAll must switch form type before reading state — or it reads the wrong form
21. Edit Staff session — getByLabel limitations, getByPlaceholder on pre-filled inputs, CSS text-transform vs real HTML, element-not-found vs hidden, 10000ms for write API toasts
22. Frontdesk portal localStorage auth — why storageState doesn't apply, real UI login for login tests, addInitScript pattern for future dashboard tests, comparison table of both portals
23. Booking workflow — unique phone/name strategy, split search/select for debounce, hasNot filter for available slots, multi-page navigation pattern, toast timing analysis
24. waitForResponse — the right signal for search results: register before typing, await after, never poll DOM when a network event is the real completion signal
