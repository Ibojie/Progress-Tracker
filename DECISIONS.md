# Decisions and assumptions

Where the spec was silent, the simplest robust option was chosen and listed here. Newest phase at the bottom.

## Phase 1: scaffold

### Process
- **Lifecycle (product-dev-team skill).** The build prompt already serves as brief, PRD and architecture, so the skill's intake, discovery, spec and architecture stages are treated as done. Each phase runs design → build → test → review → owner demo. This file doubles as the skill's project log.
- **Pull requests.** The GitHub CLI (`gh`) was installed and signed in during Phase 1. Pull requests are opened and checked with `gh`. Merges and tags happen only with the owner's go-ahead.

### Tooling
- **Tailwind CSS 3.4, not 4.** The spec asks for `darkMode: ['class', '[data-theme="dark"]']`, which is Tailwind 3 config syntax. shadcn/ui supports both.
- **shadcn/ui components are written by hand into `src/components/ui`** (same code shape the shadcn CLI produces), so the scaffold needs no interactive CLI. `components.json` is present, so `npx shadcn add <component>` works later.
- **Vite 6 and Vitest 3**, the newest majors that pair cleanly with React 18 and `@vitejs/plugin-react` 4.
- **Database tests run in PGlite** (Postgres compiled to WebAssembly) with a small stand-in for Supabase's `auth` schema. Docker is not installed, so the full local Supabase stack can't run here; this still runs the real migration files and the RLS checks on every CI run.

### Design (ui-ux-pro-max, liquid-glass-ui, type-size-standard, readable-content-standard)
- **Style: glassmorphism**, as recommended by the ui-ux-pro-max design-system search for a personal dashboard. Glass sits on cards, the header, the sidebar and the tab bar, over a soft three-colour gradient. Forms keep a solid background for contrast.
- **Typeface: Inter (variable, self-hosted via Fontsource).** The design search suggested a handwritten pairing (Caveat / Quicksand), which doesn't suit a deadline dashboard. Inter is clear at small sizes and has tabular numerals for the KPIs. Self-hosted so it works offline in Phase 4.
- **Type sizes follow the Readable Content Standard:** 19px body (19.5px on phones) and nothing a reader must read below 16px on a phone. This is larger than the spec's "at least 16px" floor; the skill wins on readability detail.
- **Primary colour blue-800 `#1E40AF`, accent emerald-700 `#047857`** in light mode; lighter blue-400 and emerald-400 in dark mode so text on them keeps AA contrast.
- **Liquid Glass JS (WebGL) is not added yet.** It's optional and desktop-only, so it's deferred to the Phase 7 polish of the dashboard hero.
- **Not loaded:** the Business Apostle brand skills, as the spec instructs.

### Theme switch
- **Switch behaviour:** one tap flips between the theme currently shown (light ↔ dark). Settings → Appearance adds "Match system".
- **Across devices:** when you sign in, the choice saved in your profile is adopted, and every flip after that is written back to the profile. If a device has a different local choice, the profile wins at sign-in.

### Database
- **`user_id` added to `status_events` and `goal_date_resets`.** The spec lists them without one, but §3.1 says every table has RLS on `user_id = auth.uid()`.
- **`user_id` defaults to `auth.uid()`** on user-written tables, so the client never sends it. Composite foreign keys make sure an element's category and a goal's element belong to the same user.
- **Extra columns:**
  - `goals.tick_changed_at` records when a goal's tick box last changed. The engine uses it to end the Restarted / Recommissioned states ("lasts until the next tick change") and to find stalls ("no tick for 14 days").
  - `goals.updated_at`, `profiles.created_at` / `updated_at`.
  - `profiles.in_app_enabled` and `profiles.ai_summary_enabled` for the per-channel toggles and the AI on/off switch in Settings (§6.6).
  - `notification_log.element_id` for element-level alerts (stalls, Resource Delay), plus `title`, `body` and `read_at` for the in-app notification centre.
- **No duplicate alerts:** `notification_log` is unique on (goal, element, kind, channel, Lagos calendar day), with NULLs treated as equal (`unique nulls not distinct`).
- **1–10 goals rule in the database:**
  - The 11th goal is blocked by a trigger that locks the element first, so two quick inserts can't both slip through.
  - "At least one goal" is a constraint trigger checked at commit. An element and its goals must be created in one transaction; Phase 2 adds a `create_element_with_goals` database function for the wizard.
  - Deleting the last goal is blocked; deleting the whole element is allowed.
  - Goals cannot be moved between elements.
- **Categories can't be added or deleted by users** (no insert/delete policy). They can be renamed.
- **History is append-only:** `status_events` and `goal_date_resets` allow read and insert only.
- **Server-written tables** (`daily_snapshots`, `ai_summaries`, `notification_log`) are read-only for users; scheduled jobs and Edge Functions write them with the service role. Users can only change `notification_log.read_at`.
- **Signed-out visitors get no access** to any table (`revoke all … from anon`).
- **Date types:** goal dates are `date` (calendar days). Event times are `timestamptz` and are shown in the user's timezone.

### Auth
- **PKCE flow** for magic links and Google, returning to `/auth/callback`. A magic link has to be opened in the same browser that requested it.
- **The client is optional:** with no Supabase env vars, the app shows a setup screen instead of crashing, so CI builds and bare previews work.

### Code review fixes (independent reviewer, before merging Phase 1)
The first migration was already live, so fixes are in a second migration, `20261026000100_harden_schema.sql`.

- **Date resets can only point at your own goals.** They now use a composite foreign key, like the other tables. Before, another user could create a reset row against your goal.
- **The no-duplicate key on alerts now includes `user_id`.** Without it, the weekly digest for one user would have blocked everyone else's that day.
- **The app can only write a goal's own content:** title, notes, dates, tick, order. `original_due_date`, `reset_count`, `done_at` and `tick_changed_at` are set by the database: the triggers, and the date-reset function coming in Phase 2.
- **Signed-out visitors can't run any database function or read any table, including ones added later.** This covers the default privileges, plus Postgres's global "everyone may run functions" default.
- **Theme sync:**
  - A flip made while the profile was still loading is no longer undone by the late answer.
  - A flip that failed to save (offline, say) is marked on the device and saved on the next sync, instead of being overwritten.
- **CI checks the gitleaks download** against its published SHA-256 before running it.

### Release
- **Production address:** https://progress-tracker-phi-five.vercel.app (Vercel's default domain), set as the Supabase Site URL.
- **Supabase redirect URLs:** localhost, every preview link (`https://*-ibojie-celestines-projects.vercel.app/auth/callback`) and production.
- **Email limit:** Supabase's built-in email sender allows only 2 sign-in emails per hour. Connecting Resend as a custom email sender (planned for Phase 5) lifts that.

## Phase 2: core CRUD and engine

### Status engine (`src/lib/engine`)
- **Dates are calendar days ('YYYY-MM-DD') in the user's timezone.** "Today" comes from `todayIn(timezone)` (default Africa/Lagos), so midnight is Lagos midnight, not UTC.
- **Overdue countdown:** a goal is overdue on days 1–7 after its due date, and "X days to abandonment" is `7 − days overdue`. So 3 days overdue shows "4 days to abandonment" (acceptance test 4), and day 7 shows 0. It is abandoned from day 8.
- **Start-date rules (spec v1.2, owner request):**
  - An element's start date is its earliest goal start date.
  - At 0%: Not Started before that date, Started automatically from it, and Resource Delay only if the user picks it after the start date.
  - The stored `zero_progress_status` value `not_started` is now just "no Resource Delay chosen", so no schema change was needed.
- **"No goal has changed since" (Restarted / Recommissioned)** means no tick-box change since that time, using `goals.tick_changed_at`. Editing a title or date doesn't end those states; only a tick does (§4.1).
- **An element with no goals** (impossible in the database, handled for safety) is treated as Started at 0%.
- **Readable text on colours:** near-black (`#0F172A`) or white, whichever contrasts more. On a few mid-tones neither reaches 4.5:1 (for example red at 3 days left, and the Recommissioned blue `#0284C7`). There, pure black is used, which always passes. A test checks every day from −10 to 120 in both themes, plus all nine status pills.
- **Dark-mode band colours:** the far edge of each band is a dark tint (`#1E2430`, `#0F1D36`, `#2A1E08`, `#2C1311`). The deep near-edge colours are the same as in light mode.
- **Coverage:** CI runs `npm run test:coverage`, which fails if `src/lib/engine` drops below 90% on lines, branches, functions or statements.

### Data and screens
- **Database functions:**
  - `create_element_with_goals` saves an element and its goals in one transaction, which the "at least one goal" rule needs. It runs as the user, so all security rules apply.
  - `reset_goal_date` runs with elevated rights, because only it may raise `reset_count`. It checks ownership itself and uses the user's own "today".
  - The engine decides whether the element was Abandoned, and the function then sets `restarted_at`.
- **Types are generated from the live database** (`npm run db:types` → `src/lib/database.generated.ts`), so the code always matches the real tables.
- **Loading:** all of a user's elements load in one request, with their goals, category and last status event. A personal tracker has few enough rows, and every screen then shares one cache.
- **Status history (`status_events`):**
  - The app writes a row whenever an element's resolved status differs from the last one recorded.
  - That catches date-driven changes (Not Started → Started) the next time the app is opened. The nightly job in Phase 3 will catch them on days the app isn't opened.
  - The first row for an element reads "Started tracking as …".
- **Ticks update on screen instantly** and are rolled back with a message if the save fails.
- **Editing a goal's due date directly** is allowed (§6.3, "edit goals"). "Reset date" is the route for abandoned goals, because it is counted and logged.
- **Deleting:**
  - The only goal of an element can't be deleted (the button is disabled, and the database blocks it too).
  - Deleting a whole element is permanent and asks for confirmation. The dialog points to switching it off instead if the history should be kept.
- **Category view:** filters for status, deadline band and show/hide completed (shown by default). Sort by nearest deadline (default), least complete, or name.
- **Category cards** show the number of active elements and the category % (done goals ÷ all goals of active elements).
- **Completed goal text** uses a "done" green token: `#15803D` in light mode (5:1 on white), `#4ADE80` in dark mode.
- **Abandoned goals:** the goal's text fades to 45%, but its **Reset date** button stays at full strength so it remains readable and tappable.
- **Deferred to Phase 3 (charts):** the element burndown chart (§6.3, chart 8) is built with the other ECharts charts.
- **Deferred to Phase 7 (polish):** the tick animation and the confetti at 100%.

### Code review fixes (independent reviewer, before merging Phase 2)
The database fixes are in migration `20261026000300_phase2_review_fixes.sql`.

1. **Edit goal / Add goal / Edit element boxes now open with the right values.** Before, Edit goal opened blank, and saving could overwrite a goal's dates. The boxes are now created fresh each time they open.
2. **The status history only records confirmed changes.** It waits while a tick is still saving and while data is reloading, so a failed save can't leave phantom history rows.
3. **Switch-off and switch-on times come from the server clock**, which also stamps tick times, so "Recommissioned" ends reliably even if the device clock is wrong. The app may now only write an element's name, description, 0% status, on/off switch and position.
4. **The History card updates straight after a change.**
5. **History logging waits until the user's own timezone has loaded**, so it never briefly uses Lagos time for someone elsewhere.
6. **The same status can't be logged twice in a row**, even from two tabs or devices at once. The database skips the repeat.
7. **Wizard error messages stay on the right goal** after one is removed.
8. **Reordering goals happens in one database step** (`swap_goal_order`), so it can't be left half done.
9. **Hardening from earlier phases:**
   - The timezone must be a real timezone name.
   - Date-reset history can only be written by `reset_goal_date`, never directly by the app.

## Phase 3: dashboard

### Periods and KPIs
- **Like-for-like comparison:** the current period runs from its start (Monday, the 1st of the month, or the quarter start) to today. It is compared with the **same stretch** of the previous period: on a Wednesday, Mon–Wed this week vs Mon–Wed last week. A custom range is compared with the same number of days just before it.
- **KPI sources:**
  - "Goals completed" counts completion dates (in your timezone) inside each range.
  - Overall completion, due in 14 days, overdue and abandoned compare today's live figure with the last nightly snapshot on or before the matching day of the previous period.
  - With no snapshot yet, the tile says "No history yet" rather than inventing a change.
- **Good or bad direction:** a rise in completion or goals completed is good (green ▲). A rise in overdue, due-soon or abandoned is bad (red ▲). Arrows and words are shown alongside the colour.
- **Sparklines** are plain SVG: tiny lines with no axes or hover, so ECharts would add size for nothing. Their values are in the tile's accessible label.

### Nightly snapshots
- **Where it runs:** the job runs inside the database (`pg_cron`, 22:55 UTC = 23:55 Lagos, no daylight saving) and calls `take_daily_snapshots()`. There is no Edge Function, so no secret keys are needed for it.
- **Same rules as the app:** the status rules are mirrored in SQL (`engine_element_status`). A test compares the SQL and TypeScript versions on 300 random elements × 5 dates (1,500 cases) on every CI run.
- **Extra snapshot columns:** `overdue_count`, `abandoned_count` and `due_soon_count`, so those KPIs have history too.
- **What the job writes:** for each user, it uses that user's own "today", upserts one row per element (re-running is safe), and logs a status change with the reason "Nightly check". The same status is never logged twice in a row.
- **Decommissioned elements** are snapshotted with that status, and every chart and KPI leaves them out.

### Advice
- **Focus Now strip:** overdue plus 0–14 days. The advice card's "Focus on" list extends to 29 days, as §7.1 says.
- **Urgency score:**
  - Overdue goals score 100 + 5 per day overdue (capped at 7 days).
  - Other goals score 60 − 2 × days left.
  - Add 0.3 × the goal's weight (100 / number of goals), and +10 if the element is behind pace.
  - Within each group (overdue, 0–14, 15–29), the highest score comes first.
- **Pace:** expected % is the average, across goals, of the share of each goal's time that has passed. "Behind pace" means more than 15 points under that.
- **Stalls:**
  - "No ticks" uses the newest tick time, so it fires at 14+ days.
  - Resource Delay and Started-at-0% count from the later of the start date and when the status was recorded, and fire at more than 7 days.
- **Wins:** elements whose last goal was completed in this period, plus the category with the biggest rise since the same point of the previous period.

### Charts
- **Colours:**
  - Categories use the validated categorical order from the dataviz guidelines: blue `#2A78D6`, orange `#EB6834`, aqua `#1BAF7A`, yellow `#EDA100`, with their dark-mode steps.
  - The current period is blue; the previous period is a muted grey and dashed.
  - Status and band colours are reserved for status and band only.
- **Accessibility:** every chart has a title, a one-line question, a tooltip, a legend for two or more series, and a **Table** switch. The drawn chart carries an accessible label pointing to the table.
- **Clicking a chart:** gauges and bars open the category, a status-mix segment opens the category filtered by status, and a donut segment opens the Timeline filtered by band.
- **Deadline calendar and Timeline are HTML, not ECharts,** so every day and every bar is a real, keyboard-reachable control or link. Calendar cells are 40px with 14–16px numbers, and the grid scrolls inside its own box on phones.
- **Charts load separately:** ECharts (≈600 KB) loads only with the charts, using modular imports and the SVG renderer. The main bundle's size is left for the Phase 7 performance pass.

### Responsive charts (owner request)
- **Every chart works at any width.** Checked with sample data at 320, 390, 768 and 1280px, in light and dark mode: no sideways page scroll, no labels outside their card, and no chart text under 16px on phones.
- **Gauges** are a grid of small charts: 2 per row on phones, 3 on tablets, 5 on desktop. Each is a link to its area.
- **Bar charts turn horizontal on phones,** so area names fit (the readable-content rule for long labels).
- **Legends are HTML lists under each chart.** They wrap onto new lines on any screen and screen readers can read them. ECharts' own legend squeezed into one scrolling line on phones.
- **Radar on phones:** a smaller radar, with names wrapped onto two lines, so the side labels stay inside the card.
- **Short label in charts:** "Personal Development" shows as "Personal Dev.", at the owner's request. Tables keep the full name.
- **Developer-only preview:** `/__dev/charts` renders the real charts with sample data, so layouts can be checked without signing in. It only exists in the local development build; production builds leave it out.

### Code review fixes (independent reviewer, before merging Phase 3)
The database fixes are in `20261027000100_snapshot_totals.sql`.

1. **Snapshot history is summed on the server** (`snapshot_totals`). The app used to download one row per element per day, and the API stops at 1,000 rows, so history was cut off after about 20 elements on the month view. Now it's at most days × 4 rows.
2. **Switched-off elements leave the history comparisons too.** Before, switching off an element with 3 overdue goals made Overdue show "▼3" in green. Totals now count only elements that are active today, on every past day (acceptance test 9).
3. **A custom range that ended in the past shows its last day,** not today's live figures. A range ending in the future runs to today.
4. **Focus Now includes goals that haven't started but are due within 14 days,** matching the "Due in 14 days" tile.
5. **Snapshots are taken at the end of each user's own day.** The job runs hourly at :55 and only snapshots users whose local time is 23:xx. Lagos users still get 23:55.
6. **The parity test also covers a tick at exactly the switch-on or restart moment.**
7. **Colour contrast:** the previous-period grey is now slate-500 `#64748B` (4.8:1 on white).
   - The category yellow `#EDA100` is kept, because it's from the validated palette. It falls under the palette's "relief rule": every gauge also shows its name and % as text, and every chart has a table.
8. **The radar's previous-period shape** is drawn only when every area has history. A missing value isn't 0%.

## Phase 4: installable app and offline use

### Installing
- **App identity:** the manifest has name "Progress Tracker", short name "Progress", theme `#1E40AF`, `display: standalone` and start URL `/`.
- **Icons:**
  - 192px and 512px "any" icons (a rounded tile).
  - A 512px "maskable" icon, with the mark inside the central 70% so Android can crop it to any shape.
  - A 180px Apple touch icon.
  - All are rendered from SVG by `npm run icons` (`scripts/generate-icons.mjs`).
- **Install prompt:**
  - Where the browser offers installation (Chrome, Edge, Android), the app shows its own **Install app** button: in a one-time Dashboard banner (it can be hidden) and always under Settings.
  - On iPhone and iPad, which have no install prompt, the same places show the Share → Add to Home Screen steps. These are needed on iPhone for push reminders in Phase 5 (§9).

### Service worker
- **Our own service worker** (`src/sw.ts`, Workbox, `injectManifest`), so Phase 5 can add push to it.
- **What it stores:** the app shell (HTML, JS, CSS, fonts, icons), about 1.6 MB. Every page address opens the stored shell.
- **What it doesn't store:** Supabase requests. They're never served stale.
- **Updates:** a new version downloads in the background (checked hourly while the app is open), and the app offers **Update now**. It never reloads by itself, so nothing you're typing is lost.
- **Caching on Vercel:** `sw.js` and the manifest are served with `Cache-Control: no-cache`, so updates are picked up.
- **Checked here:** with the local server switched off, the production build still opened and routed from the device copy.

### Offline data and the queue
- **Your data on the device:** the TanStack Query cache is saved in IndexedDB (via `idb-keyval`) for up to 7 days, so elements, goals and the dashboard are readable offline.
- **Signing out deletes that copy** from the device. If changes are still waiting to sync, the app warns first.
- **Queued while offline:** ticking and unticking, editing a goal (title, notes, dates), editing an element (name, description, Started / Resource Delay), and reordering goals.
  - Each shows on screen at once.
  - The queue is saved with the cache, and resumes after the app is closed and reopened.
  - Changes are sent **in order, one at a time** (one TanStack mutation scope).
- **Online only (owner agreed):** creating an element, adding or deleting a goal or element, Reset date, and switching an element off or on. These depend on server checks or could conflict between devices. Offline, their buttons are disabled with "Needs a connection".
- **If a queued change fails** when it is finally sent, the screen is corrected from the server and a message explains.
- **Offline banner:** "Offline · showing your saved data", or "Offline · N changes will sync…", and while sending, "Syncing N changes…".
- **Status history waits** while queued changes are pending, so it only records statuses the server has confirmed.

## Open questions for the owner
- A custom domain, if wanted (production runs on the Vercel default domain for now).
- **Google sign-in (owner request, scheduled right after Phase 4):** the owner creates a Google OAuth client, then we enable the Google provider in Supabase.
- **After all phases (owner request):** a Privacy Policy, Terms of Service, Fair Use and Refund policies, plus in-app account deletion, as Google Play requires.
