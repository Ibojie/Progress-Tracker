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

## Open questions for the owner
- A custom domain, if wanted (production runs on the Vercel default domain for now).
- A Google OAuth client is needed if Google sign-in is wanted (optional).
