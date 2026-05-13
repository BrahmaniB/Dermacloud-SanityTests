# DermaCloud Tests — Pending Test Scenarios

All test scenarios that are planned but not yet written, grouped by area.
Each section notes what is already done so the list is self-contained.

---

## Section 1: Frontdesk Staff Portal (New — started this session)

The frontdesk portal at `/frontdesk/login` uses localStorage auth (not cookies).
See `documentation.md` Key Pattern 2 and `learning.md` Chapter 22 for details on
the auth mechanism and the `addInitScript` approach for future dashboard tests.

| # | Test | File | Status |
|---|---|---|---|
| 1 | Frontdesk portal login (3 tests) | `frontdesk-portal-login.spec.ts` | Done ✅ |
| 2 | Full booking workflow: login → dashboard → add patient → book appointment | `frontdesk-book-appointment.spec.ts` | Done ✅ |
| 3 | Dashboard nav tabs visible (Appointments, Patients, Pharmacy, Sales) | `frontdesk-dashboard.spec.ts` | Pending |
| 4 | Dashboard stats cards render | `frontdesk-dashboard.spec.ts` | Pending |
| 5 | Dashboard today's schedule (empty state and populated state) | `frontdesk-dashboard.spec.ts` | Pending |
| 6 | Navigate to Appointments tab | `frontdesk-portal-nav.spec.ts` | Pending |
| 7 | Navigate to Patients tab | `frontdesk-portal-nav.spec.ts` | Pending |
| 8 | Navigate to Pharmacy tab | `frontdesk-portal-nav.spec.ts` | Pending |
| 9 | Navigate to Sales tab | `frontdesk-portal-nav.spec.ts` | Pending |

**Note for tests 3–9:** These will need `page.addInitScript()` to inject `frontdeskToken`
and `frontdeskStaff` into localStorage before navigation — storageState does not work
for frontdesk. See `learning.md` Chapter 22, section 4 for the full planned pattern.

---

## Section 2: Clinic Admin — Frontdesk Staff Management

Already completed: add staff (3 navigation paths via `frontdesk.spec.ts`),
edit staff name and phone with pre-fill assertion and success toast (`frontdesk-edit.spec.ts`).

| # | Test | Status |
|---|---|---|
| 1 | Deactivate staff → status badge changes from "Active" to "Inactive", button title becomes "Activate" | Pending |
| 2 | Activate staff (re-enable a deactivated staff) → status badge changes back to "Active" | Pending |
| 3 | Close Add modal via X button → modal closes, staff count unchanged, no staff added | Pending |
| 4 | Close Add modal via Cancel button → modal closes, staff count unchanged, no staff added | Pending |
| 5 | Add staff form validation — submit empty form → required field errors shown, modal stays open | Pending |
| 6 | Add staff form validation — password under 6 characters → error or browser block shown | Pending |

---

## Section 3: Form Settings — Both Forms (14 scenarios)

Already completed: section toggle, field toggle, required/optional pill, required pill disabled
state, add custom field lifecycle, and empty label validation — for both Dermatology
(`forms.spec.ts`, 7 tests) and Cosmetology (`cosmetology-forms.spec.ts`, 7 tests).

### Shared scenarios (apply to both Dermatology and Cosmetology)

| # | Test | Status |
|---|---|---|
| 1 | Bottom Save button shows "No Changes" text when nothing is pending | Pending |
| 2 | Bottom Save button switches to "Save Changes" when a toggle or pill is changed | Pending |
| 3 | Cancel out of Add Custom Field modal via X button — modal closes, no field added | Pending |
| 4 | Cancel out of Add Custom Field modal via Escape key — modal closes, no field added | Pending |
| 5 | Cancel out of Delete confirm modal — field still exists in the section after Cancel | Pending |
| 6 | Add custom field with textarea type — saves correctly and appears in the section | Pending |
| 7 | Switch from Cosmetology back to Dermatology — teal border returns, purple border gone, Dermatology sections reload | Pending |
| 8 | Batch save — toggle 2–3 fields without saving between them, then save once — all changes persist | Pending |

### Dermatology-only scenarios

| # | Test | Status |
|---|---|---|
| 9 | Section toggle (Active ↔ Hidden) on remaining Dermatology sections (only "Clinical Examination" tested so far) | Pending |
| 10 | Field toggle and Required/Optional pill on fields outside the Clinical Examination section | Pending |
| 11 | Add Custom Field in Dermatology sections other than Clinical Examination | Pending |

### Cosmetology-only scenarios

| # | Test | Status |
|---|---|---|
| 12 | Patient Information — Skin Type (Fitzpatrick) field toggle and Required/Optional pill | Pending |
| 13 | Patient Information — Primary Concern field (starts as Required) — toggle to Optional and back | Pending |
| 14 | Procedure Details section toggle (Active ↔ Hidden) and all 6 field tests: Procedure Name, Treatment Goals, Session Number, Package/Plan, Products & Parameters, Immediate Outcome | Pending |
| 15 | Aftercare & Follow-up section toggle and all 5 field tests: Prescription (Rx), Aftercare Instructions, Home Products Recommended, Follow-up Date, Expected Results Timeline | Pending |
| 16 | Consent & Risks section toggle and both field tests: Risks Explained, Consent Confirmed | Pending |
| 17 | Add Custom Field in Cosmetology sections other than Assessment & Analysis | Pending |

---

## Section 4: Other Pages (not yet started)

| Page | Pending scenarios |
|---|---|
| Login (`/login`) | Successful login with real credentials redirects to `/clinic/dashboard`; wrong password shows error div; empty fields block submission |
| Signup (`/signup`) | Password strength indicators: each requirement (8+ chars, uppercase, lowercase, number, special char) turns green when met |
| Patients | View patient list; add patient; search/filter by name |
| Appointments | Book appointment; view day/week schedule |
| Pharmacy | View inventory list |
| Sales | Create a sale entry |
