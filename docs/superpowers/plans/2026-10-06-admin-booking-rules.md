# Admin Booking Rules Update

Goal: Keep the two enforced day-based limits, but explain them using the current button-first booking flow and Korean calendar boundaries. Do not change saved rules, reservation records, queue SQL, or server authorization.

Design: Localize the rules panel in English/Korean. Label the opening window separately from maximum equipment use per booking. Show a draft preview with actual open dates, the hard end boundary, and the next midnight opening. Keep the two-minute queue-entry deadline explicitly separate and conditional on queue activation. Use the same date helpers as booking validation; refresh the preview when the Korean date changes. Preserve the existing Save Rules action and admin lock.

- [x] Add a failing regression for bilingual rules fields and the boundary preview.
- [x] Add a small presentational rules-fields component, translated descriptions and scoped responsive styles; integrate it into the existing admin form.
- [x] Verify midnight/month/year boundaries in four timezones, invalid drafts, existing date limits, production build and isolated browser behavior.
- [x] Review the final diff. Report local changes and deployment separately.

Files: app/admin/page.tsx, components/admin-booking-rule-fields.tsx, lib/i18n.ts, app/globals.css, scripts/verify-admin-rules.cjs. No new packages or database migration.

Verification: verify-admin-rules.cjs passed 41 checks in each of four timezones (164 total); verify-booking-window.cjs passed 88 checks; npm run build and git diff --check passed. Browser QA used a loopback-only server with a unique temporary file store, empty Supabase credentials and a test-only admin credential. Confirmed unsaved changes disappear on reload, zero is rejected, valid settings persist after saving/reload, English/Korean descriptions, and no horizontal overflow at a 390px mobile viewport. Existing operational settings and bookings were not modified. No commit, push or Render deployment performed.
