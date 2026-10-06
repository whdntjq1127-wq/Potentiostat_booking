# Booking Session Reset and Timeout

Goal: Home always starts at Book Now after reload. Calendar admission starts a fixed two-minute turn; expiry closes the calendar/form and returns to the entry page without a retry modal. Waiting time is not deducted from the admitted turn.

Root cause: Home restores sessionStorage entry/selection. Disabled queue responses have no deadline and the client bypasses the timer when enabled=false.

Design: Remove Home restoration, release the previous browser turn on Home mount before enabling entry, and hide/clear all selection state on expiry. Keep existing SQL-backed admission when queue mode is enabled. When disabled, issue a server-signed HttpOnly two-minute turn cookie, preserve its deadline during polls/repeated joins, and check it before create/edit API actions. Reads/cancellations/admin actions stay unchanged. Existing SQL needs no migration. Do not modify operational data, existing admin-panel edits, or push/deploy without a request.

- [x] Add failing token/hook/API regressions.
- [x] Implement standalone server turn, always-on timer and reload/expiry reset.
- [x] Align bilingual guidance and setup docs; adapt HTTP tests to obtain a turn.
- [x] Run build, server/client/window regressions and isolated browser tests for reload and actual expiry.

Verification: production build passed. Token and non-queue API regressions cover exact 120-second expiry, signature tampering, missing admission, no extension on status/repeated join, clearing on save/leave, and expired create/edit rejection. Existing queued API, booking-window (88), admin-preview (164), queue-gate, persistence and legacy-recovery tests passed. Browser QA on isolated loopback fixtures confirmed refresh returns to the entry screen from the calendar, an open form, and a waiting queue. Actual two-minute expiry closed an unsaved form and calendar with no blocking modal; a new click restarted at 02:00 with an empty name. Korean entry rendering was also checked. No operational data, SQL, commit/push or Render deployment changed.
