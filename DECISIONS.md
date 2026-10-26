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

## Open questions for the owner
- A custom domain, if wanted (production runs on the Vercel default domain for now).
- A Google OAuth client is needed if Google sign-in is wanted (optional).
