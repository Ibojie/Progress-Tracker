# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.6.1] - 2026-10-28 - Owner feedback on the dashboard cards

### Added
- **View more / View less** on **Your weekly insight** and **Progress and advice**.
  - Long content starts collapsed with a soft fade.
  - The choice is remembered on each device.
  - Tabbing into the hidden part opens it.

### Fixed
- Switching the AI insight on or off updates the dashboard straight away. A failed "is AI set up?" check is retried instead of hiding the card until the next refresh.

## [0.6.0] - 2026-10-29 - Phase 6: AI weekly insight and data export

### Added
- **Your weekly insight** on the dashboard: a short coaching note from Claude with 3 things to do this week, 1 risk to watch and 1 thing to celebrate, under 180 words.
  - **Refresh insight** gets a new one, up to 5 times a day.
  - A new one is written every Monday before the digest, and the Monday email includes it as **Your coach's take**.
- **Privacy:** Claude receives only area and element names, percentages, statuses, urgency, days left, pace and weekly counts. Never goal titles, notes or your email.
- **Settings → AI weekly insight:** an on/off switch that explains what is shared.
- **Settings → Export your data:** everything as JSON, or your goals as CSV for Excel or Google Sheets.

### Fixed (from the Phase 6 code review)
- **The card waits for the server** to confirm the AI is set up, so it never shows without a key.
- **The 5-a-day limit holds** even with rapid repeat taps. Failed attempts count too.
- **Monday insights can't slow down the reminders:**
  - short timeout;
  - at most 3 tries;
  - the digest waits up to two hours for its insight.
- **Matches the dashboard's advice:** pace is judged the same way as the rule-based advice, including elements with nothing ticked yet.
- **Better output and export:**
  - replies that ignore the format, or run long, are discarded;
  - the export includes the daily history, and reads every page whatever the server's limit;
  - the insight's date uses your timezone.

## [0.5.1] - 2026-10-28 - Push fixes from the owner's device tests

### Fixed
- **Push notifications now show on Android.** The server's push encryption was replaced: phones silently dropped the old messages.
- Pushes are sent at high priority, so they aren't delayed while the phone sleeps.
- The bell lights up and refreshes as soon as a notification arrives, and test pushes appear in it.
- On desktop Chrome, turning push on retries automatically if the first try fails.
- New versions of the app switch over by themselves when it's safe, instead of waiting behind **Update now**.

### Added
- **Send test push** now reports whether the push reached the device, and **Local test** checks the device's own notification settings.

## [0.5.0] - 2026-10-28 - Phase 5: notifications

Live at https://progress.thebusinessapostle.net (the custom domain), with Google sign-in.

### Added
- **Reminders at 07:00 in your own timezone:**
  - goals due in 21, 14, 7, 3 and 1 days, and due today;
  - every overdue day ("X days left before this goal is abandoned");
  - a goal or element that becomes abandoned;
  - weekly nudges for Resource Delay over 7 days and for elements with no ticks for 14 days.
- **Push notifications** on phone and desktop (Web Push).
  - Tapping one opens the element.
  - Each device is switched on in Settings.
  - **Send test push** checks the setup.
- **Emails** from `reminders@notify.thebusinessapostle.net` (Resend):
  - due today, overdue day 1 and day 6, and abandoned;
  - a **Monday digest** of last week: goals completed against the week before, completion, due soon, overdue, and the Focus Now list.
- **Notification centre:** a bell at the top of every screen with an unread count, also shown on the installed app's icon where supported.
- **Settings → Notifications:** push, email and in-app switches, quiet hours, and your timezone.
- **Database:**
  - `queue_notifications` decides every alert;
  - an hourly job calls the new `notify` Edge Function;
  - a secret in Supabase Vault protects the job.

### Fixed (from the Phase 5 code review)
- **Shared devices:** signing out, or a session ending, stops this device's reminders. A device moves to whoever signs in on it next.
- **One notification per goal on the phone:** before, alerts for several goals in one element replaced each other.
- **Missed runs:** a missed 07:00 run is caught up later the same day, never during quiet hours.
- **Stalled nudges:** they count from the start date, so an element isn't "stalled" the day it starts.
- **No double sends:** emails can't be sent twice after a crash (idempotency keys). Sending is paced and time-limited.
- **Stale alerts are dropped:** a waiting push or email is skipped once its goal is ticked or its element switched off.
- **Security:**
  - push addresses must belong to a real push service;
  - notification links can't leave the app;
  - the app-icon count clears on sign-out.
- **Settings:**
  - switches have 44px tap areas;
  - quiet hours save as soon as a time is picked, and From and Until can't be equal;
  - iPhone asks for permission straight from the tap.

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
