# Reusable Booking Turn Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution. The user explicitly approved retaining admission after saving, with the original two-minute deadline.

**Goal:** Allow additional bookings until the original admission deadline without returning Home after each successful save.

**Architecture:** Keep the existing three-person FIFO and immutable admission deadline. Successful queue writes update only the heartbeat, not state, slot or expiry. Non-queue writes retain their existing signed cookie. Home closes the completed form while preserving admission. New selection keeps the existing fresh-form behavior. Expiry, Exit Booking and reload still end admission.

**Tech Stack:** Next.js/React/TypeScript, PostgreSQL functions, Node/PGlite regression scripts.

## Tasks

- [x] Add failing SQL, direct HTTP and Home handler tests for two saves in one turn and unchanged expiry. Retain conflict/expired-write protections.
- [x] Replace the completion update in `database/booking-queue.sql` with `update public.pb_booking_queue set heartbeat_at = v_now where session_hash = p_session;`. Never assign `expires_at` on save.
- [x] Remove successful-write cookie deletion from `app/api/reservations/actions/route.ts`. Leave admission and expiry validation unchanged.
- [x] Replace Home's success-only `resetBookingScreen()` with `setSelectedSlot(null); setEndAt('');`; retain `bookingRequested` and queue state.
- [x] Update queue SQL/API tests to release slots explicitly rather than expecting save to release them. Test a waiting visitor remains waiting until exit/expiry.
- [x] Update `docs/BOOKING_QUEUE_SETUP.md` and README with repeated-booking behavior and rollout: run the full updated `database/booking-queue.sql`, then deploy the app.
- [x] Run all CJS checks, SQL/capacity/five-channel checks, build and both HTTP integration suites. Verify two UI saves and timeout against an isolated local fixture.
- [x] Review the diff and report deployment requirements. Do not commit, push, change production records or execute live SQL without authorization.

## Verification Commands

`node scripts/verify-queue-sql.mjs`

`node scripts/verify-booking-turn-api.mjs`

`node scripts/verify-booking-session.cjs`

`node scripts/verify-queue-capacity.mjs`

`node scripts/verify-five-channels-sql.mjs`

`npm.cmd run build`

`node scripts/verify-queue-api.mjs`

Run `scripts/verify-*.cjs` sequentially and `git diff --check` before reporting completion. Tests use isolated temporary stores/PGlite, never production.

## Results

- Red observed before implementation: SQL reported `complete` after save, direct HTTP reported `idle`, and the Home handler test lost its calendar.
- All ten CJS verification scripts, queue SQL, capacity/upgrade, five-channel SQL, both HTTP suites, and the production build passed.
- Browser fixture: admission began at 02:00; CH4 and CH5 were saved separately with 01:48 and 01:40 remaining. Both appeared on the still-open calendar without rejoining.
- At the original deadline, the third unsaved form and calendar closed, showing the two-minute expiry message on Home. No browser warnings or errors were logged.
- Independent scoped code review reported no actionable findings. Whitespace checks passed.
- Operational Supabase SQL and app deployment are still required; no live data, environment configuration, commits or pushes were changed.
