# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

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
