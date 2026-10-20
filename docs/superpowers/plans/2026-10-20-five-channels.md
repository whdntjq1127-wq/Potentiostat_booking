# Five Booking Channels

**Goal:** Expand equipment channels to CH 1 through CH 5, preserving the three-person queue and each visitor's two-minute turn.

**Design:** Extend the central typed channel list and gray color maps. Existing calendar, drag selection, multi-channel form and editing options derive from that list. Widen the calendar via its channel count and use five desktop picker columns, retaining a wrapped mobile picker. Validate channels at the server boundary. Update the database channel constraint and allow up to five bookings per queue commit.

## Implementation

- [x] Add and run failing application/rendering and SQL migration tests.
- [x] Extend the channel list, colors, bilingual description and metadata; preserve existing channels' colors and records.
- [x] Reject unsupported channels in create/edit requests. Update desktop picker/calendar sizing without changing mobile behavior.
- [x] Update fresh-install schema and the existing rerunnable booking-queue.sql upgrade. Keep admission slots at three and lease duration at two minutes.
- [x] Verify five-channel creation, editing, cancellation, drag selection, per-channel conflicts, five-item atomic saves, upgrade safety and existing regressions.
- [x] Build, inspect the diff, and document the required SQL-before-deploy steps. Do not push, deploy or change live data.

## Deployment

Existing Supabase projects must run the entire updated database/booking-queue.sql once before deploying the five-channel app. This widens the named channel check constraint and queue write limit without deleting bookings, logs, settings or queue tickets. RESERVATION_QUEUE_ENABLED is unchanged and controls only visitor admission, not the number of equipment channels.

## Verification

On 2026-10-20 the new tests first failed against the three-channel list and the SQL three-booking limit, then passed after implementation. Production build, five-channel rendering/service/SQL tests, queue SQL/capacity/client/copy/gate/API checks, signed-turn unit/API tests, 88 booking-window checks, 164 admin rendering checks, persistence and legacy recovery checks passed. Fresh schema and legacy upgrade were tested separately in isolated PGlite databases.

Browser verification used only a loopback server and an in-memory database: all five channels selected and saved successfully; Korean mobile layout at 390px displayed five buttons in a 3+2 grid without document overflow; dragging CH 4 through CH 5 from 14:00 through the 15:00 block opened the form with both channels and a 14:00-16:00 range. Temporary viewport, browser tab and test server were cleaned up. No live data, environment values, commits, pushes or deployments were changed.
