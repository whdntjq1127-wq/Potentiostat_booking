# Calendar Pages and Opening Notice Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution. The user approved both previews on 2026-10-20; no further design approval is needed.

**Goal:** Show Monday-Friday and Saturday-Sunday as two calendar pages, and add bilingual opening rules above Book Now.

**Architecture:** Keep the existing reservation/queue backend untouched. Use a Monday-based presentation helper and local page state in WeeklySchedule; preserve separate week navigation. Render the opening notice from the real booking-window setting, rather than hardcoding two days when an administrator changes it.

**Tech Stack:** Next.js 15, React 19, TypeScript, existing CSS and Node verification scripts.

## Approved Behavior

- Initial calendar page is Monday-Friday, with five equipment channels per day.
- Right arrow opens Saturday-Sunday; left arrow returns to weekdays.
- Preserve whole-hour click/drag booking, cancellation, week navigation, queue admission and the two-minute expiry.
- Keep the desktop table within the available width, show 24 compact hour rows, and retain usable mobile cells.
- Show the opening notice before admission, in the selected language, with a 21st-midnight example.
- Default three-day booking window means midnight opens the date two days ahead. Recompute the copy for other settings.
- Do not change database records, SQL, queue capacity, commits, pushes or deployment.

## Tasks

- [x] Add failing coverage for Monday-based pages, Sunday/month/year boundaries, page navigation, five-channel clicks/drags, and bilingual notices.
- [x] Implement the presentation date helper and page toolbar. Reset in-progress drag when changing page/week. Keep week navigation separate.
- [x] Add the notice component and translations; show a loading explanation until settings are ready. Only advertise three simultaneous entrants when queue mode is enabled.
- [x] Apply compact responsive CSS without changing unrelated pages. Remove desktop automatic scrolling that would hide the new page controls.
- [x] Update the existing five-channel rendering assertions for the new default five-day page.
- [x] Run build, rendering/date/queue tests, API integration tests, and browser checks on an isolated local fixture.
- [x] Inspect the final diff and report local changes and deployment status.

## Verification

Run `node scripts/verify-calendar-pages.cjs`, `node scripts/verify-opening-notice.cjs`, `node scripts/verify-five-channels.cjs`, the existing booking-window/admin/queue/turn checks, and `npm.cmd run build`.

Run `node scripts/verify-queue-api.mjs` and `node scripts/verify-booking-turn-api.mjs` against their isolated fixture databases. For UI verification use `node scripts/verify-queue-api.mjs --serve --empty`; never test writes against the production URL.

Inspect desktop weekday/weekend widths, bilingual notice text, week navigation, CH4/CH5 form prefill, mobile controls, reload-to-entry and timer preservation.

## Results

- All nine `scripts/verify-*.cjs` checks pass, including failed-fetch notice regression coverage.
- Queue and direct-turn API integration checks pass against isolated local databases.
- Final production build passes compilation, type checking and static generation.
- Browser: 1280x720 weekday/weekend pages show all 24 hours without page overflow; page/week switching and CH5 form prefill work. Handler tests cover CH4/CH5 dragging and cancellation.
- Browser: Korean/English notices match loaded rules; reload returns to entry; 390px mobile has no horizontal document overflow and keeps the table scrollable for readable cells.
- Review fixes: administrator notices size to content instead of reserving 380px; failed settings loads show an error instead of announcing default rules.
- No production data, SQL, commit, push or deployment changes. Temporary fixture servers and browser tabs were closed.
