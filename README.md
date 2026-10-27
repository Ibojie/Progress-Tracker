# Progress Tracker

A personal Progressive Web App for tracking goals and deadlines in four areas of life: Paid Job, Business, Investment and Personal Development. Its main job is to make sure no deadline is missed.

The full specification is in [`docs/PROGRESS_TRACKER_BUILD_PROMPT.md`](docs/PROGRESS_TRACKER_BUILD_PROMPT.md). Assumptions are logged in [`DECISIONS.md`](DECISIONS.md) and releases in [`CHANGELOG.md`](CHANGELOG.md).

**Status:** Phase 4 (installable app and offline use) released as v0.4.0. Live at https://progress-tracker-phi-five.vercel.app. See the changelog for what works today.

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

## Environment variables

| Variable | Where it lives | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local`, Vercel | Project URL, public |
| `VITE_SUPABASE_ANON_KEY` | `.env.local`, Vercel | Publishable key, public (RLS protects the data) |
| `VITE_VAPID_PUBLIC_KEY` | `.env.local`, Vercel | Phase 5 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets only | Never in the client or the repo |
| `RESEND_API_KEY` | Supabase secrets | Phase 5 |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Supabase secrets | Phase 6 |
| `VAPID_PRIVATE_KEY` | Supabase secrets | Phase 5 |

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

- **Site URL:** the production URL (for example `https://progress-tracker.vercel.app`)
- **Redirect URLs:** `http://localhost:5173/auth/callback` and `https://<your-vercel-domain>/auth/callback` (add `https://*-ibojie-celestines-projects.vercel.app/auth/callback` for preview deployments)

Google sign-in is optional: enable it under **Authentication → Providers → Google** with a Google OAuth client ID and secret.

## Deploy

The GitHub repo is connected to Vercel. Every pull request gets a preview URL and every merge to `main` deploys to production. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's environment variables. `vercel.json` rewrites all routes to `index.html` for client-side routing.

## Install on a phone

- **Android (Chrome):** open the app, then tap **Install app** on the Dashboard card or under Settings (or Chrome's **⋮** menu → **Install app**).
- **iPhone (Safari):** tap **Share** → **Add to Home Screen** → **Add**. On iPhone, installing is also what enables push reminders (Phase 5).
- **Desktop (Chrome or Edge):** use the install icon in the address bar.

Once installed, the app opens offline with your saved data. Ticks and edits made offline sync when you're back online.

## Workflow

Each phase is built on its own branch (`phase-1-scaffold`, `phase-2-engine`, …), opened as a pull request into `main`, merged once CI is green and the owner has tested it, then tagged (`v0.1.0`, `v0.2.0`, …). Commits follow Conventional Commits.
