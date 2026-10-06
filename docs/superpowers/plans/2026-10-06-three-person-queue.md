# Three-Person Booking Queue Implementation Plan

**Goal:** Admit up to three browser sessions, then queue further visitors in FIFO order. Each admitted session keeps its own fixed two-minute deadline.

**Architecture:** Retain the existing Supabase advisory transaction lock shared by admission and booking writes. Replace the single-active index with three numbered slots, a check constraint and a unique active-slot index. Refill all vacant slots in ticket order. No per-channel admission restrictions; booking overlap is still checked atomically on save.

**Tech stack:** Next.js, TypeScript, PostgreSQL/Supabase, Node verification scripts and isolated PGlite fixtures.

## Scope And Decisions

- Queue remains opt-in through RESERVATION_QUEUE_ENABLED=true; disabled mode remains unchanged.
- Waiting position 1 means next to enter; active visitors are not counted as waiting.
- Use the existing rerunnable database/booking-queue.sql for both clean install and upgrade. Preserve reservations, logs, settings, tickets and existing deadlines.
- Update both Korean and English queue/admin explanations.
- No production DB changes, commit, push or deployment in this task.

## Steps

- [x] Add scripts/verify-queue-capacity.mjs covering three admissions, fourth waiting, fixed leases, expiry, refill, constraints and upgrade safety; run it against the old implementation and confirm failure on the second admission.
- [x] Update database/booking-queue.sql to lock migration with key 910042, backfill active_slot=1 for legacy active tickets, enforce slots 1..3, clear slots on all terminal transitions, and fill every vacancy in FIFO order.
- [x] Adapt scripts/verify-queue-sql.mjs and scripts/verify-queue-api.mjs to the new capacity. Verify simultaneous requests for the same channel/time save exactly once.
- [x] Update components/booking-queue-panel.tsx, lib/i18n.ts and docs/BOOKING_QUEUE_SETUP.md with accurate bilingual capacity and upgrade instructions. Verify rendered copy.
- [x] Run capacity, SQL, queue gate/client, timed-session, booking-window, admin rendering, persistence and real API regression checks plus production build and git diff --check.

## Verification Notes

PGlite is single-connection. Concurrent HTTP tests validate application behavior and database constraints but do not constitute production load testing across independent PostgreSQL backends. Production activation requires executing the updated SQL before enabling the Render flag. Existing signed two-minute sessions without a queue are unaffected.

Verified on 2026-10-06: capacity and bilingual-copy tests first failed against the old behavior, then passed. Production build passed. All queue SQL/API/capacity/copy/gate/client checks, signed-turn unit/API checks, 88 booking-window checks, 164 admin-rendering checks, persistence, and legacy-recovery checks passed. The API test admitted exactly three of twelve concurrent requests and saved only one of two competing channel/time requests. Upgrade and rerun fixtures retained all booking/log/settings data and existing lease deadlines. Diff review and whitespace checks passed (Git emitted only Windows line-ending warnings).
