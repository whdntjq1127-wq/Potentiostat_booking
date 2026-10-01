# Booking Queue Implementation Plan

Goal: Ship the approved bilingual queue, channel boxes, and Book Now flow without losing reservations.

Architecture: A server-only opt-in flag enables a durable Supabase FIFO. One PostgreSQL transaction lock serializes queue changes and reservation commits. An HttpOnly random browser cookie identifies a queue session; only its hash is stored. A two-minute lease permits one atomic create/update transaction. Waiting sessions heartbeat and expire after five minutes. Public reads and cancellations remain available. Queue errors fail closed when enabled.

Tech stack: Existing Next.js/React/TypeScript; PostgreSQL RPC through existing server-only Supabase REST client; PGlite for isolated SQL regression tests.

1. Add failing regression for booking without a queue turn. Add SQL tests for FIFO, duplicate joins, expiry, rollback, consumed tokens, independent channels and restricted grants.
2. Add additive database/booking-queue.sql migration. Never replace existing snapshots. Add queue/status/commit methods to the Supabase store, server session API, action gate, and reject legacy snapshot replacement while queue mode is enabled.
3. Add reusable bilingual queue hook/panel. Select calendar slots first, press Book Now, show waiting modal, automatically admit to the existing channel-box form. Restore slot/session on refresh; cancel/expiry releases the lease. Apply the same gate to reservation edits.
4. Verify disabled-mode compatibility, SQL integration, concurrent API requests, refresh, countdown, Korean/English and mobile rendering. Run booking-window, persistence, legacy recovery and production build checks.
5. Document SQL migration then RESERVATION_QUEUE_ENABLED=true in Render. Commit only scoped files, push main, and report activation separately from code deployment.

Limits: Anonymous browser sessions cannot enforce one human/one ticket across devices. This is reservation admission control, not a general traffic shield. Waiting polls can consume database/API resources. PGlite tests SQL transactions but cannot reproduce independent PostgreSQL backend lock scheduling; production load testing remains necessary.
