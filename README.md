# Progress Tracker

A personal Progressive Web App for tracking goals and deadlines in four areas of life: Paid Job, Business, Investment and Personal Development. Its main job is to make sure no deadline is missed.

The full specification is in [`docs/PROGRESS_TRACKER_BUILD_PROMPT.md`](docs/PROGRESS_TRACKER_BUILD_PROMPT.md). Assumptions are logged in [`DECISIONS.md`](DECISIONS.md) and releases in [`CHANGELOG.md`](CHANGELOG.md).

**Status:** all seven build phases done (Phase 7, polish and launch-readiness, released as v0.7.0). Live at https://progress.thebusinessapostle.net (also https://progress-tracker-phi-five.vercel.app). See the changelog for what works today.

## Stack

Vite + React 18 + TypeScript (strict) · Tailwind CSS + shadcn/ui · TanStack Query · Supabase (Postgres, Auth, RLS, Edge Functions) · Vercel · Vitest · GitHub Actions.

## Run it locally

You need Node 20 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
```

Without the two Supabase values the app still starts and shows a setup screen.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm test` | Unit tests plus the database tests (migrations run in an in-memory Postgres) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript checks |
| `npm run build` | Production build into `dist/` |
| `npm run e2e` | End-to-end tests in a real browser (Playwright), desktop and phone sizes. Run `npx playwright install chromium` once first |

## Environment variables

| Variable | Where it lives | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local`, Vercel | Project URL, public |
| `VITE_SUPABASE_ANON_KEY` | `.env.local`, Vercel | Publishable key, public (RLS protects the data) |
| `VITE_VAPID_PUBLIC_KEY` | optional | Push public key, safe to share. Built into `src/features/notifications/push.ts`; set this only to override it |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets only | Never in the client or the repo |
| `RESEND_API_KEY` | Supabase secrets | Resend key with sending access to `notify.thebusinessapostle.net` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Supabase secrets | The AI weekly insight. The model defaults to `claude-sonnet-5-5`. Without the key the insight card simply doesn't appear |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Supabase secrets | Push key pair; the subject is the operator contact (`mailto:`) |
| `APP_URL`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Supabase secrets, optional | Defaults: the production URL, `reminders@notify.thebusinessapostle.net`, the owner's inbox |

`.env*` files are git-ignored except `.env.example`. CI runs a gitleaks secret scan on every push.

## Database

Migrations live in `supabase/migrations`. To apply them to the hosted project, run these yourself (the CLI asks for the database password; never paste it anywhere else):

```bash
npx supabase login
npx supabase link --project-ref nvfhyxnmazhtnlqguerr
npx supabase db push
```

`supabase/seed.sql` is for a local Supabase stack only (`npx supabase start`, needs Docker).

### Auth settings in the Supabase dashboard

Under **Authentication → URL Configuration**:

- **Site URL:** `https://progress.thebusinessapostle.net`
- **Redirect URLs:** `http://localhost:5173/auth/callback`, `https://progress.thebusinessapostle.net/auth/callback`, `https://progress-tracker-phi-five.vercel.app/auth/callback`, and `https://*-ibojie-celestines-projects.vercel.app/auth/callback` for preview deployments

**Google sign-in** is on: **Authentication → Providers → Google**, with the OAuth client "Progress Tracker" from the Google Cloud project `project-tracker-512809`. Its authorised redirect URI is `https://nvfhyxnmazhtnlqguerr.supabase.co/auth/v1/callback`. The consent screen is in Testing until the privacy policy is published.

## Notifications

- **Email** is sent through Resend from `notify.thebusinessapostle.net` (DKIM and SPF records in the SirSteveHQ DNS zone).
- **Push** uses Web Push with the VAPID keys above.
- **Every hour at :00**, a pg_cron job calls the `notify` Edge Function with a shared secret kept in Supabase Vault (`notify_cron_token`, created by the migration). The function:
  1. queues the alerts due for every user whose local time is 07:00, or the end of their quiet hours (`queue_notifications`), then
  2. delivers every waiting push and email, retrying failures up to 5 times.
- In-app alerts appear in the bell at the top of the screen.

Deploy the function after `db push`:

```bash
npx.cmd supabase functions deploy notify --use-api
```

## AI weekly insight

- **What it is:** a short coaching note (3 actions, 1 risk, 1 win; at most 180 words) on the dashboard and in the Monday email.
- **What Claude receives:** `ai_summary_input`, a compact summary of area and element names, percentages, statuses, bands, days left, pace and weekly counts. Goal titles, notes, email addresses and ids are never sent.
- **When it's written:**
  - Every Monday, by the hourly `notify` job, before the digest goes out.
  - On demand with **Refresh insight** (the `ai-summary` function), up to 5 times a day.
- **No key?** Without `ANTHROPIC_API_KEY`, or if a call fails, the card hides and the rule-based advice carries on.

```bash
npx.cmd supabase functions deploy ai-summary --use-api
```

**Settings → Export** downloads everything as JSON, or your goals as CSV. It's read through the signed-in user's own access rules.

## Deploy

The GitHub repo is connected to Vercel. Every pull request gets a preview URL and every merge to `main` deploys to production. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's environment variables. `vercel.json` rewrites all routes to `index.html` for client-side routing.

## Install on a phone

- **Android (Chrome):** open the app, then tap **Install app** on the Dashboard card or under Settings (or Chrome's **⋮** menu → **Install app**).
- **iPhone (Safari):** tap **Share** → **Add to Home Screen** → **Add**. On iPhone, installing is also what enables push reminders (Phase 5).
- **Desktop (Chrome or Edge):** use the install icon in the address bar.

Once installed, the app opens offline with your saved data. Ticks and edits made offline sync when you're back online.

## End-to-end tests

`npm run e2e` builds the app and drives it in Chromium at desktop and phone sizes.
- **No real account:** the app talks to an in-memory fake Supabase (`e2e/fakeSupabase.ts`), so no account or live data is involved, and CI needs no secrets.
- **What they cover:**
  - the sign-in page;
  - acceptance tests 1, 12, 14 and 15;
  - the confetti on completion;
  - keyboard use and 320px phones;
  - account deletion;
  - an automatic WCAG 2.1 AA check (axe) on every main screen in light and dark mode.
- **On failure:** CI runs them on every push and uploads a Playwright report.

## Workflow

Each phase is built on its own branch (`phase-1-scaffold`, `phase-2-engine`, …), opened as a pull request into `main`, merged once CI is green and the owner has tested it, then tagged (`v0.1.0`, `v0.2.0`, …). Commits follow Conventional Commits.
