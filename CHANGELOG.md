# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.4.0] - 2026-10-27 - Phase 4: installable app and offline use

### Added
- **Installable app:** app manifest, icons (including maskable and Apple), an Install app button where the browser offers it, and Add to Home Screen steps on iPhone.
- **Service worker:** stores the app shell for offline opening, and offers **Update now** when a new version is ready.
- **Data saved on the device (IndexedDB)** so the app reads offline. It is cleared on sign-out.
- **Offline queue:** ticks, goal and element edits, and reordering are kept offline and sent in order when back online, even after a restart.
- **Offline banner** with the number of changes waiting. Online-only actions say they need a connection.

### Fixed (from the Phase 4 code review)
- Opening the app while already offline keeps the queue paused instead of sending and losing it.
- Dropped connections are retried with back-off. An update the server didn't apply counts as a failure.
- Saved data is cleared on any sign-out and when a different user signs in.
- Restored changes that fail show a message. The offline banner and update prompt are announced to screen readers.
- A tick made offline counts on the day it was tapped, not the day it synced (`tick_goal`).

## [0.3.0] - 2026-10-27 - Phase 3: dashboard

### Added
- **Focus Now strip:** every overdue goal and every goal due within 14 days, most urgent first, each with a one-tap tick. Always shown.
- **KPI tiles:** overall completion, goals completed, due in 14 days, overdue and abandoned, each with a ▲/▼ change against the same point of the previous period and a sparkline.
- **Period switcher:** week, month, quarter or custom, with Monday weeks in your timezone. The choice is remembered.
- **Rule-based advice:** summary, focus list, behind pace, keep tabs on, stalls and wins.
- **Charts:** completion gauges, goals completed by area, momentum, status mix, open goals by urgency, a 90-day deadline calendar, and a balance radar.
  - Each has a table view, and clicking one opens the matching elements.
  - They adapt to phones, tablets and desktop.
- **Burndown chart** on every element page.
- **Timeline:** a Gantt view of all goals, with band colours, a Today line, filters, and sideways scrolling on phones.
- **Nightly snapshots** at the end of each user's day (pg_cron, hourly at :55). They power the trends and log date-driven status changes.
  - The status rules are mirrored in SQL and checked against the app on 1,500 random cases.
- **`snapshot_totals` database function:** daily history summed on the server.

### Fixed (from the Phase 3 code review)
- History comparisons leave out elements that are switched off now.
- History is no longer cut off at 1,000 rows.
- A custom range in the past shows its own figures.
- Focus Now includes soon-due goals that haven't started yet.
- The previous-period grey has enough contrast on white.
- The radar no longer draws a missing value as 0%.

## [0.2.0] - 2026-10-26 - Phase 2: elements, goals and the status engine

### Added
- Status engine (`src/lib/engine`): the nine statuses and their resolution order, % complete, overdue and abandoned rules, start-date rules (spec v1.2), time bands, and OKLCH colour gradients with AA text contrast in both themes.
- New Element wizard: category and name, 1–10 goals with dates, review showing the starting status, plus quick templates.
- Category view: element cards with band-coloured edge, status pill with %, progress, next goal and warnings, plus filters and sorting.
- Element detail:
  - Goal checklist with ticks, dates, "X days left" chips, overdue and abandoned states, and green completed goals.
  - Add, edit, reorder and delete goals.
  - Reset date for abandoned goals.
  - The 0% status selector, locked before the start date.
  - Decommission switch, status history, and edit or delete the element.
- Settings → Archive for decommissioned (switch back on) and completed elements.
- Database functions `create_element_with_goals` and `reset_goal_date`, and generated database types.
- CI enforces at least 90% test coverage on the engine.

### Fixed (from the Phase 2 code review)
- Edit goal, Add goal and Edit element open with the current values.
- Status history records only confirmed changes, refreshes straight away, waits for the user's timezone, and never logs the same status twice in a row.
- Switch-off and switch-on times use the server clock.
- Reordering goals is a single step.
- Wizard error messages stay on the right goal.
- Timezones must be real names, and reset history can only be written by `reset_goal_date`.

## [0.1.0] - 2026-10-26 - Phase 1: scaffold

Live at https://progress-tracker-phi-five.vercel.app

### Added
- Vite + React 18 + strict TypeScript app with Tailwind CSS and shadcn/ui-style components.
- Light and dark design tokens (CSS variables), CSS glass surfaces over a soft gradient, and readable type sizes.
- Sun/moon switch in the header on every screen, plus Light / Dark / Match system under Settings → Appearance. The choice is saved on the device and in the profile, and an inline script applies it before first paint.
- Supabase client, email magic-link and Google sign-in, sign-in callback and sign-out.
- App layout: bottom tab bar on phones, left sidebar on desktop. Dashboard and Categories show the four seeded categories; other screens are placeholders.
- Database migration with every table from the spec, Row Level Security on all of them, the four categories created on signup, a 1–10 goals-per-element rule, and a no-duplicates key for notifications.
- Database tests that run the migrations in an in-memory Postgres and check RLS and the goal rules.
- GitHub Actions CI: lint, type-check, tests, build and a gitleaks secret scan.
- README, DECISIONS, `.env.example` and a Vercel SPA rewrite.

### Security (from the Phase 1 code review)
- A date reset can only point at the user's own goal.
- Alert de-duplication is per user, so weekly digests don't collide.
- The app can't rewrite a goal's bookkeeping columns.
- Signed-out visitors can't read tables or run functions, including ones added later.
- CI verifies the secret-scanner download.

### Fixed
- A theme flip made while the profile was still loading is no longer undone, and a failed save is retried.
- `vercel.json` now uses Vercel's supported rewrite pattern.
