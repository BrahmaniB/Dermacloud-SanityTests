import { Page, Locator } from '@playwright/test';

// FrontdeskSalesPage represents /frontdesk/sales
// Source: DermaCloud/app/frontdesk/sales/page.tsx
//
// AUTH MECHANISM — localStorage (NOT cookies):
//   Same pattern as all frontdesk pages. Arrives here via router.push() from the
//   "Dispense" button on /frontdesk/appointments — localStorage is already set
//   from the earlier frontdesk login, so auth is automatically preserved.
//
// HOW THIS PAGE IS ENTERED IN THE E2E FLOW:
//   The "Dispense" button on the appointments page calls router.push() with:
//     /frontdesk/sales?action=new&patientId=...&patientName=...&patientPhone=...
//                     &aptDate=...&appointmentId=...
//   On mount, a useEffect reads window.location.search:
//     - action === "new"   → setShowNewSaleModal(true)   (auto-opens the modal)
//     - patientId present  → setSaleForm({ patientName, patientPhone })
//                           + fetchPrescription(patientId, aptDate, appointmentId)
//   This means the modal opens AND the prescription starts loading simultaneously,
//   before any user interaction. Our wait methods account for this timing.
//
// KEY ASYNC BEHAVIOURS (understand before writing tests):
//   1. Modal auto-opens   — triggered by useEffect on mount, NOT a button click
//   2. Prescription fetch — GET /api/tier2/sales/prescription — async, can be slow
//   3. Inventory fetch    — GET /api/tier2/inventory?limit=500 — populates the datalist
//      options for the Product Name input. Fires when showNewSaleModal becomes true.
//   4. Save Sale POST     — POST /api/tier2/sales — creates the sale record
//
// PRODUCT NAME INPUT STRATEGY:
//   The medicine field uses a native HTML <datalist> (NOT a custom React dropdown).
//   This is different from the doctor's prescription form which uses a custom div.
//   With datalist:
//     - invSuggestions are fetched from inventory and rendered as <option> elements
//     - User types a partial name → browser shows native autocomplete suggestions
//     - Selecting a suggestion fires the onChange handler with the full inventory name
//     - The onChange then matches the name against invSuggestions → auto-fills itemId,
//       mrp, gstRate, manufacturer, batchNo, expiryDate from the matched inventory item
//   In Playwright: type partial name → press ArrowDown → press Enter
//   This selects the first datalist suggestion and fires onChange with the exact name.
//
// WHY qty IS NOT FILLED SEPARATELY:
//   EMPTY_SALE_ITEM initialises qty to 1. The form starts with one EMPTY_SALE_ITEM,
//   so the first row already has qty=1. No need to change it for a basic dispense.
//
// PREREQUISITE:
//   At least one medicine must exist in the clinic's pharmacy inventory (InventoryItem).
//   The seed script does not seed inventory — add one manually via the pharmacy page
//   before running the full e2e suite, or extend seed-test-db.ts to include it.

export class FrontdeskSalesPage {

  // ─── PAGE LEVEL ───────────────────────────────────────────

  // h1 "Sales" in the page header — confirms the sales page has loaded
  // Source line 513: <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
  private pageHeading: Locator;

  // ─── NEW SALE MODAL ───────────────────────────────────────

  // h2 "New Sale" inside the modal — confirms the modal has rendered
  // Source line 1453: <h2 className="text-lg font-bold text-gray-900">New Sale</h2>
  // WHY h2 not the backdrop div? h2 is text-based — more stable than class-based
  // selectors when Tailwind classes change. The modal also contains ONLY one h2.
  private newSaleModalHeading: Locator;

  // ─── PRESCRIPTION PANE ────────────────────────────────────

  // "Loading..." text inside the prescription pane — present while fetchPrescription()
  // is in flight. Disappears when the API call resolves (success or failure).
  // Source line 1299: <div ...>...Loading...</div>  (renders when loadingPrescription===true)
  // WHY wait for this to disappear? we must not interact with the sale items until
  // prescription fetch is done, because fetchInvSuggestions() also runs at the same
  // time — if invSuggestions are not yet loaded, the datalist has no options to show.
  private prescriptionLoadingText: Locator;

  // ─── SALE ITEMS ───────────────────────────────────────────

  // Product Name input — uses list="sale-inv-list-fds" attribute (unique on this page)
  // The datalist element with id="sale-inv-list-fds" holds all inventory item names.
  // Source line 1531: <input list="sale-inv-list-fds" placeholder="Type to search inventory...">
  // WHY list attribute? it's the only stable, unique way to target this input —
  // it has no id, no aria-label, and the placeholder text could change.
  // Use .nth(index) because each sale item row renders one such input.
  private productNameInputs: Locator;

  // ─── SAVE BUTTON ──────────────────────────────────────────

  // "Save Sale" submit button at the bottom of the modal form
  // Source line 1608: <button type="submit" ...>{submitting ? "Saving..." : "Save Sale"}</button>
  // WHY getByRole with name? the button text changes to "Saving..." during submission,
  // but getByRole({ name: 'Save Sale' }) targets the accessible name at click time
  // (before submission starts), which is always "Save Sale".
  private saveSaleButton: Locator;

  // ─── TOAST ────────────────────────────────────────────────

  // Success toast shown after sale is created
  // Source line 323: showToast("success", `Sale saved — ${data.data.invoiceNumber || data.data.saleId}`)
  // WHY regex? the suffix is a dynamic invoice number (e.g. "INV-00001") or a saleId UUID.
  private successToast: Locator;

  constructor(private page: Page) {

    // h1 "Sales" — the only h1 on the page
    this.pageHeading = page.locator('h1').filter({ hasText: 'Sales' });

    // h2 "New Sale" — rendered inside the modal when showNewSaleModal === true
    this.newSaleModalHeading = page.locator('h2').filter({ hasText: 'New Sale' });

    // "Loading..." text — inside the amber prescription pane during fetchPrescription()
    this.prescriptionLoadingText = page.getByText('Loading...');

    // Product name inputs — all inputs with list="sale-inv-list-fds" on the page
    // Use .nth(0) for the first sale item row (index 0-based)
    this.productNameInputs = page.locator('input[list="sale-inv-list-fds"]');

    // Save Sale button — targeted by role so text-to-button mapping is robust
    this.saveSaleButton = page.getByRole('button', { name: 'Save Sale' });

    // Success toast — scoped to the toast message span to avoid matching the sales list.
    // WHY span.flex-1? the toast renders:
    //   <span class="font-medium text-base flex-1">{toast.message}</span>
    // The sales list also contains "Sale saved — ..." text but in a span with different
    // classes (text-sm font-medium text-teal-800). Scoping to flex-1 targets only the
    // toast. Without this, getByText(/Sale saved/) resolves to 2 elements → strict mode.
    this.successToast = page.locator('span.flex-1').filter({ hasText: /Sale saved/ });
  }

  // ─── ACTIONS ─────────────────────────────────────────────

  // Navigate directly to the sales page.
  // NOTE: in the e2e flow, you do NOT call this — the Dispense button on the
  // appointments page navigates here automatically via router.push(). Use this
  // only for isolated sales page tests that don't come from the appointments flow.
  async navigate(): Promise<void> {
    await this.page.goto('/frontdesk/sales');
  }

  // Wait for the sales page h1 to be visible — confirms the page has loaded.
  // Call this after page.waitForURL(/frontdesk\/sales/) to ensure React has hydrated.
  async waitForLoad(): Promise<void> {
    await this.pageHeading.waitFor({ state: 'visible', timeout: 15000 });
  }

  // Wait for the "New Sale" modal to open.
  // The modal auto-opens on mount when action=new is in the URL. The h2 "New Sale"
  // is the most reliable signal — it only renders when showNewSaleModal is true.
  // WHY 15000ms? the useEffect fires after React hydration, which can be slow on
  // a first-visit page load (Next.js cold start + MongoDB cold connection).
  async waitForNewSaleModal(): Promise<void> {
    await this.newSaleModalHeading.waitFor({ state: 'visible', timeout: 15000 });
  }

  // Wait for the prescription fetch to complete.
  // The pane shows "Loading..." while fetchPrescription() is in flight. We wait for
  // this text to DISAPPEAR — meaning the API call resolved (success or failure).
  // We also implicitly wait for fetchInvSuggestions() to have had time to run,
  // since both start at the same time (when showNewSaleModal becomes true).
  // WHY 20000ms? prescription fetch round-trips to MongoDB — cold connections can
  // take up to 15s. We give extra headroom to avoid flaky timeouts.
  async waitForPrescriptionToLoad(): Promise<void> {
    await this.prescriptionLoadingText.waitFor({ state: 'hidden', timeout: 20000 });
  }

  // Wait for the inventory datalist to have at least one <option> attached.
  // fetchInvSuggestions() fires on modal open → GET /api/tier2/inventory?limit=500
  // → React sets invSuggestions → options render inside <datalist id="sale-inv-list-fds">.
  // WHY DOM polling instead of waitForResponse?
  //   waitForResponse starts its countdown at registration time. By the time we await it,
  //   navigation + modal render have already consumed several seconds of that budget —
  //   making the timeout unreliable. Polling the DOM is unaffected by elapsed time.
  // WHY state 'attached' not 'visible'?
  //   <option> elements inside <datalist> are never visible (the datalist is hidden).
  //   'attached' just confirms the element exists in the DOM — which is all we need
  //   to know that React has rendered the inventory items into the list.
  async waitForInventoryLoaded(): Promise<void> {
    await this.page
      .locator('#sale-inv-list-fds option')
      .first()
      .waitFor({ state: 'attached', timeout: 30000 });
  }

  // Type a medicine name into the Product Name input at the given item index.
  // WHY pressSequentially? the input's onChange uses React state to track value.
  // fill() writes to the DOM directly without firing individual keydown/input events,
  // so React's onChange never fires and the datalist match logic never runs.
  // pressSequentially fires a real keystroke event per character — onChange fires after
  // each character and the match check runs. When the full name is typed, if it exactly
  // matches an inventory item's name, itemId + mrp + gstRate auto-fill.
  // WHY delay: 60? gives the browser time to update the datalist suggestions between
  // keystrokes on slower machines. 60ms is conservative but avoids flakiness.
  async fillProductName(itemIndex: number, name: string): Promise<void> {
    const input = this.productNameInputs.nth(itemIndex);
    await input.click();
    await input.pressSequentially(name, { delay: 60 });
  }

  // Press ArrowDown + Enter to select the first suggestion from the native datalist.
  // HOW IT WORKS:
  //   1. After typing, the browser shows native datalist suggestions filtered by value
  //   2. ArrowDown moves focus to the first suggestion in the browser's native dropdown
  //   3. Enter confirms the selection — the browser sets the input's value to the
  //      selected option text and fires the 'input' event
  //   4. React listens to 'input' events via its synthetic onChange — fires with the
  //      full exact inventory item name → matchedInv found → itemId + mrp set
  // WHY not fill() after ArrowDown? the datalist is a browser-native UI element.
  // The only way to confirm a datalist selection is via keyboard or mouse on the
  // browser's dropdown — you cannot inject the value with fill() after the dropdown
  // opens because that would bypass the browser's own change-event dispatch.
  async selectFirstFromDatalist(itemIndex: number): Promise<void> {
    const input = this.productNameInputs.nth(itemIndex);
    await input.press('ArrowDown');
    await input.press('Enter');
  }

  // Click "Save Sale" and wait for the success toast to confirm the POST succeeded.
  // WHY scrollIntoViewIfNeeded? the modal is flex-col with a scrollable body — the
  // Save button is in the sticky footer, but on very small viewports or long forms
  // it may be clipped. scrollIntoViewIfNeeded is a no-op if already visible.
  // WHY 45000ms? POST /api/tier2/sales writes Sale + InventoryTransaction records
  // in a MongoDB transaction. On a machine running a headed browser + dev server,
  // the first POST can take 30+ seconds when the route compiles cold.
  async clickSaveSale(): Promise<void> {
    await this.saveSaleButton.scrollIntoViewIfNeeded();
    await this.saveSaleButton.click();
    await this.successToast.waitFor({ state: 'visible', timeout: 45000 });
  }

  // ─── GETTERS ─────────────────────────────────────────────

  getPageHeading():          Locator { return this.pageHeading; }
  getNewSaleModalHeading():  Locator { return this.newSaleModalHeading; }
  getSuccessToast():         Locator { return this.successToast; }
  getSaveSaleButton():       Locator { return this.saveSaleButton; }

}
