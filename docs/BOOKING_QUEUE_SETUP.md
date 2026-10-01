# Booking Queue Setup

The queue is implemented in this repository but is OFF until explicitly enabled. Deploying this commit alone keeps normal booking available through the new Book Now button. Existing reservations are not migrated, replaced or deleted by queue setup.

## One-time activation

1. In the existing Supabase project, open SQL Editor, create a new query, and run all of `database/booking-queue.sql`. The existing `database/schema.sql` must already be installed. Do not replace the project or delete existing tables.
2. In the Render web service, open Environment and add `RESERVATION_QUEUE_ENABLED` with value `true`. Keep the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` unchanged. Save and deploy.
3. After deployment finishes, use two separate browsers (or a normal and private window). Select a calendar block and press Book Now in each. The first browser should show the form and a 02:00 countdown; the second should show position 02. Cancel the first turn and verify the second is admitted automatically.
4. Confirm both English and Korean using the site's language control. Confirm one small test booking appears in the calendar/logbook, then cancel it normally.

If setup has not been completed, no fake waiting order is displayed. If enabled but SQL/credentials are missing or the database is unavailable, the queue refuses new bookings rather than bypassing admission. Set the flag to `false` and redeploy only if intentionally reverting to the old, no-queue booking behavior. Do not delete queue tables to disable it.

## Operating behavior

- Calendar viewing and cancellations remain open to everyone.
- New bookings and reservation edits require a turn. The first valid request serialized by the database gets the earlier ticket; client clocks do not decide order.
- One browser session is admitted at a time, for two minutes. Multiple selected channels are committed together in one transaction with the public logbook, and the turn is consumed once.
- Waiting browsers poll every two seconds. Next admission is normally observed on the next poll, not instantaneously. Background browser throttling and network delays can add latency.
- Refresh keeps the HttpOnly browser session cookie and queue position. The main calendar also restores the selected slot from session storage, but does not store the name/password there. Refresh does not extend the two-minute lease.
- Waiting sessions expire after five minutes without a heartbeat. Active sessions expire after two minutes even if a tab closes. Old terminal tickets are cleaned up during queue traffic after one day.
- A turn is not a hold on a channel/time slot. Availability is rechecked when saving. Conflicts leave the turn open for another attempt within its remaining time.
- Browser legacy-snapshot recovery is disabled in queue mode because it replaces the whole snapshot outside the queue transaction. Existing stored records remain unchanged. Historical recovery needs a separately reviewed administrator procedure.
- Queue data is server-only. Anonymous users cannot enumerate tickets or call queue database functions directly. Multiple devices/private windows can still represent one person; preventing that requires authentication and abuse controls.
- This is not a general load balancer, DDoS shield or guaranteed midnight latency solution. Use an always-on Render instance, monitor database/API usage, and load-test expected traffic before a competitive launch. Do not assume an unlimited visitor capacity.

## Verification

- `node scripts/verify-queue-gate.cjs`
- `node scripts/verify-queue-client.cjs`
- `node scripts/verify-queue-sql.mjs`
- `pnpm build` then `node scripts/verify-queue-api.mjs`
- Existing booking-window, persistence, and legacy-recovery scripts should also pass with queue mode disabled.

Tests use only an in-memory PostgreSQL database through PGlite and a loopback REST fixture. They do not read operational credentials or modify live reservations. PGlite is single-connection; independent PostgreSQL backend lock scheduling and production capacity still need staging/load testing.

PostgreSQL transaction lock reference: https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS
PGlite test extension reference: https://pglite.dev/extensions/
