# Booking Queue Setup

The queue is implemented in this repository but is OFF until explicitly enabled. The Book Now button starts a two-minute booking session even with the queue OFF. Existing reservations are not migrated, replaced or deleted by queue setup. The refresh/timeout UI update needs no additional SQL migration.

## One-time activation

1. In the existing Supabase project, open SQL Editor, create a new query, and run all of `database/booking-queue.sql`. The existing `database/schema.sql` must already be installed. Do not replace the project or delete existing tables.
2. In the Render web service, open Environment and add `RESERVATION_QUEUE_ENABLED` with value `true`. Keep the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` unchanged. Save and deploy.
3. After deployment finishes, use two separate browsers (or a normal and private window). Press Book Now on the entry screen in each, without selecting any slot first. The first browser should show the calendar and a 02:00 countdown; the second should show position 02. Choose Exit Booking in the first browser and verify the second calendar opens automatically.
4. Confirm both English and Korean using the site's language control. Confirm one small test booking appears in the calendar/logbook, then cancel it normally.

If setup has not been completed, no fake waiting order is displayed. If enabled but SQL/credentials are missing or the database is unavailable, the queue refuses new bookings rather than bypassing admission. Set the flag to `false` and redeploy only if intentionally reverting to the old, no-queue booking behavior. Do not delete queue tables to disable it.

## Operating behavior

- The home page initially shows a prominent Book Now button. The calendar appears after admission (or immediately after pressing the button if queue mode is disabled). My Bookings remains accessible from navigation without joining the queue, including cancellations.
- Clicking a calendar block or dragging a range opens the booking form directly. A name and final Save are still required; dragging never silently saves a reservation. Closing this form returns to the calendar without losing the current turn. Exit Booking releases the turn and returns to the entry screen.
- Notices remain visible in the calendar header rather than an automatic entry popup.
- New bookings and reservation edits require a turn. The first valid request serialized by the database gets the earlier ticket; client clocks do not decide order.
- With the queue enabled, one browser session is admitted at a time, for two minutes starting when the calendar is admitted, including time spent selecting blocks. Waiting time is not deducted. Multiple selected channels are committed together in one transaction with the public logbook, and the turn is consumed once. Successful submission returns to the entry screen with a confirmation.
- With the queue disabled, users enter immediately but still receive a fixed two-minute server-signed HttpOnly turn cookie. Create/edit API requests require a valid, unexpired turn. Polling or repeating Join does not extend the existing deadline. The cookie is cleared after a successful write or Leave. Its signature uses the server-only ADMIN_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY; local file mode without either uses a process secret and ends turns on restart.
- Waiting browsers poll every two seconds. Next admission is normally observed on the next poll, not instantaneously. Background browser throttling and network delays can add latency.
- Refreshing/reopening Home always returns to Book Now and releases the previous browser turn before entry is enabled. Waiting position, calendar selection and form contents are not restored. Refresh also releases a waiting ticket, so pressing Book Now joins at the back again. Home never joins automatically.
- At expiry, Home closes the calendar and every booking/cancellation popup, clears unsaved form data and shows the entry screen with a short message. A new button click is required. A submission already received before expiry can still finish; its result is shown on the entry screen. Browser scheduling/background throttling can delay visible UI updates, but the server rejects expired new submissions.
- Waiting sessions expire after five minutes without a heartbeat. Active sessions expire after two minutes even if a tab closes. Old terminal tickets are cleaned up during queue traffic after one day.
- A turn is not a hold on a channel/time slot. Availability is rechecked when saving. Conflicts leave the turn open for another attempt within its remaining time.
- Browser legacy-snapshot recovery is disabled in queue mode because it replaces the whole snapshot outside the queue transaction. Existing stored records remain unchanged. Historical recovery needs a separately reviewed administrator procedure.
- Queue data is server-only. Anonymous users cannot enumerate tickets or call queue database functions directly. Multiple devices/private windows can still represent one person; preventing that requires authentication and abuse controls.
- This is not a general load balancer, DDoS shield or guaranteed midnight latency solution. Use an always-on Render instance, monitor database/API usage, and load-test expected traffic before a competitive launch. Do not assume an unlimited visitor capacity.

## Verification

- `node scripts/verify-queue-gate.cjs`
- `node scripts/verify-queue-client.cjs`
- `node scripts/verify-booking-turn.cjs`
- `node scripts/verify-booking-turn-api.mjs`
- `node scripts/verify-queue-sql.mjs`
- `pnpm build` then `node scripts/verify-queue-api.mjs`
- Existing booking-window, persistence, and legacy-recovery scripts should also pass with queue mode disabled.

Tests use only an in-memory PostgreSQL database through PGlite and a loopback REST fixture. They do not read operational credentials or modify live reservations. PGlite is single-connection; independent PostgreSQL backend lock scheduling and production capacity still need staging/load testing.

PostgreSQL transaction lock reference: https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS
PGlite test extension reference: https://pglite.dev/extensions/
