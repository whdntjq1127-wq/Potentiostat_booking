# Button-First Booking Implementation Plan

Goal: Replace select-then-join with Book Now -> queue -> calendar -> select/drag -> booking form.

Architecture: Keep server admission and atomic booking writes unchanged. The main page initially renders one prominent booking action, with existing navigation/language controls retained. An explicit entry marker restores waiting/active sessions even before a slot is selected. Only an admitted session sees the calendar. Clicking/dragging directly opens the existing required-name form. Closing the form returns to the calendar without releasing the lease; Exit Booking releases it. Successful submission returns to the entry screen with confirmation.

Tech stack: Existing Next.js, React, TypeScript and bilingual copy. No new packages or database migration.

- [x] Add a failing API-render regression: initial HTML contains Book Now and no calendar table.
- [x] Update main page entry, session restoration, direct selection, form dismissal and exit behavior. Keep CH boxes, dates, notices inline, and server enforcement.
- [x] Update bilingual instructions and responsive entry/session styling. Preserve cancellation access through My Bookings in navigation.
- [x] Check fresh entry, waiting refresh without a selection, automatic calendar admission, multi-slot drag, close/reselect, session refresh, expiry and save. Verify Korean and English.
- [x] Run production build, queue/API/client/SQL/window/persistence/recovery regressions, review diff, and report deployment separately.

The user's required name and final Save remain; dragging alone never silently creates a reservation. The existing two-minute lease includes calendar selection time. Auto-opening notice popups are replaced by the existing inline notice panel so the first screen remains button-only. Production activation settings remain unchanged.

Verification: production build and queue API/client/SQL/gate, booking-window (88 checks), persistence and legacy recovery scripts passed. Browser QA used an isolated local PGlite fixture, not production records. Verified waiting refresh before selection, automatic admission, click and actual two-hour/two-channel pointer drag, required name, successful save, form dismissal, active refresh with and without selection, exit, English/Korean, and a 390px mobile entry screen. Expiry enforcement is covered by the automated API/client/SQL tests. Render deployment was not performed as part of this UI change.
