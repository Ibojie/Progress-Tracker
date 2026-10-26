# Progress Tracker: Build Prompt for Claude Code

*Owner: Dr. Celestine Ibojie · Version 1.2 · 26 Oct 2026*
*Repository: https://github.com/Ibojie/Progress-Tracker*

> **How to use this:** Clone the repo (`git clone https://github.com/Ibojie/Progress-Tracker.git`), put this file in the repo root, open Claude Code in that folder, and say: *"Read PROGRESS_TRACKER_BUILD_PROMPT.md and build it phase by phase. Commit and push to GitHub at the end of each phase, then stop and show me what to test."*

**Changes in v1.1:** added GitHub version control (§2.1), a light/dark mode switch (§10.1), and the custom skills to load (§2.2).

**Changes in v1.2:** at 0%, the start date now drives the status. Before an element's start date it is automatically **Not Started**; from the start date it automatically becomes **Started**, and the user can still mark it **Resource Delay** (§3, §4.1, §4.2, §4.6, §6.3, §14 tests 3 and 17).

---

## 1. Role and mission

You are a senior full-stack engineer building a production-quality **Progressive Web App (PWA)** called **Progress Tracker**. It is a personal dashboard where one user tracks progress in four areas of life: **Paid Job, Business, Investment and Personal Development**.

**Why this app exists:** the owner has lost real opportunities because deadlines slipped past unnoticed. He lost a promotion because he did not follow up on his Performance Management Indicators (PMI), and he missed a NEBOSH exam assignment deadline. **The main job of this app is to make sure no deadline is missed again.** Every design decision should support that: urgent items are always visible, the colours show urgency, and the app sends reminders.

Build it correctly first, then make it look good. Where this spec is silent, pick the simplest robust option and **list the assumption in `DECISIONS.md`**. Do not stop to ask about small details.

---

## 2. Tech stack (fixed)

| Layer | Choice |
|---|---|
| Frontend | Vite + React 18 + TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui components, with a CSS glass design layer (see §10) |
| Charts | Apache ECharts via `echarts-for-react`. It supports gauges, calendar heatmaps, Gantt-style custom series, radar and sparklines. |
| State and data | TanStack Query, with the query cache persisted to IndexedDB for offline reads |
| Backend | Supabase: Postgres, Auth (email magic link + Google), Row Level Security, Edge Functions, `pg_cron` |
| PWA | `vite-plugin-pwa` (Workbox): installable, offline app shell, custom service worker for push |
| Push | Web Push with VAPID keys, sent from a Supabase Edge Function using the `web-push` library |
| Email | Resend, called from a Supabase Edge Function |
| AI summary | Anthropic Claude API, called **only** from a Supabase Edge Function. The key is never sent to the client. The model name comes from an env var (`ANTHROPIC_MODEL`, default `claude-sonnet-5-5`). |
| Hosting | Vercel for the frontend |
| Tests | Vitest for the logic engine, Playwright for the end-to-end flows |
| Dates | `date-fns` + `date-fns-tz`. The default timezone is **Africa/Lagos** (user-changeable). Weeks start on **Monday**. |
| Version control | Git + GitHub: **https://github.com/Ibojie/Progress-Tracker** (see §2.1) |
| CI | GitHub Actions: lint, type-check, Vitest and build on every push and pull request |

### 2.1 Version control (GitHub)

All code, migrations, Edge Functions, tests and docs live in **https://github.com/Ibojie/Progress-Tracker**.

- **First step of Phase 1:** clone the repo (or `git remote add origin` it if you started locally) and check you can push. If the repo already has files, keep them and build around them; never force-push over existing history.
- **Branching:** `main` is always deployable. Do each phase on its own branch (`phase-1-scaffold`, `phase-2-engine`, …), open a pull request into `main`, and merge it once the checks pass and the owner has tested the phase.
- **Commits:** small and frequent, using Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Push at the end of every working session so nothing exists only on one laptop.
- **Tags:** tag each finished phase (`v0.1.0` after Phase 1, `v0.2.0` after Phase 2, … `v1.0.0` at launch) and keep a `CHANGELOG.md`.
- **Never commit secrets.** `.gitignore` must cover `.env*` (except `.env.example`), `node_modules`, `dist`, `.vercel` and `supabase/.temp`. Commit a `.env.example` that lists every variable with an empty value. Run a secret scan (for example `gitleaks`) in CI.
- **What goes in the repo:** `/src`, `/supabase/migrations`, `/supabase/functions`, `/supabase/seed.sql`, `/tests`, `/public` (icons and manifest), `README.md`, `DECISIONS.md`, `CHANGELOG.md`, `.env.example`, `.github/workflows/ci.yml`, and this prompt file under `/docs`.
- **Deployment:** connect the GitHub repo to Vercel, so each pull request gets a preview URL and every merge to `main` deploys to production.
- If you cannot push (no access or no credentials), stop and tell the owner exactly what access is needed. Do not keep working without version control.

### 2.2 Custom skills to load

The owner has custom skills installed. Load each one with the Skill tool **before** the work it covers, and follow it. If a skill conflicts with this spec, this spec wins on **behaviour and logic**, and the skill wins on **visual and readability** detail. Log any conflict in `DECISIONS.md`.

| Skill | Load it when | What it governs here |
|---|---|---|
| `product-dev-team` | At the start, before Phase 1 | Running the build as a lifecycle: spec check, design, build, QA and launch for each phase |
| `ui-ux-pro-max` and `uupm-site-builder` | Phase 1 (design tokens) and Phase 3 (dashboard) | Dashboard layout pattern, colour tokens for light and dark themes, font pairing, chart-type choices, UX guidelines |
| `frontend-design` | Phase 3 and Phase 7 | Making the dashboard look intentional, not like a template |
| `liquid-glass-ui` | Phase 1 (base styles) and Phase 7 (polish) | CSS frosted glass as the default; Liquid Glass JS for the desktop dashboard hero only (§10) |
| `type-size-standard`, `responsive-content-standard`, `readable-content-standard` | Before writing the first stylesheet or layout, and again in Phase 7 | Type sizes, spacing, tap targets, mobile and desktop layout. Use `readable-content-standard:audit-page` to check each screen in Phase 7 |
| `dataviz` | Before writing any chart code (Phase 3) | Chart colours, marks, legends, tooltips, and consistency in light and dark mode |
| `engineering:testing-strategy` and `engineering:code-review` | Phase 2 and before every pull request is merged | Test plan for the engine; review of each phase's diff |
| `engineering:deploy-checklist` | Before the production deploy | Pre-launch checks |
| `design:accessibility-review` | Phase 7 | WCAG AA audit of colours, contrast, keyboard use and screen readers |

**Do not load** the Business Apostle brand skills (`business-apostle-standards`, `business-apostle-brand-kit`, `business-apostle-audit`). This is a private, personal app, not a published Business Apostle product. The only exception is if the owner later asks for the Business Apostle look.

---

## 3. Domain model

```
Category (fixed 4) ──< Element ──< Goal (1–10 per element)
```

- **Category:** Paid Job, Business, Investment, Personal Development. These four are seeded and cannot be deleted.
- **Element:** something being monitored inside a category. Examples:
  - *Paid Job:* Salaried Job, Outstanding Trainings, Job Applications, Performance Management (PMI)
  - *Business:* Naija Commerce, Match Mate Matters, Naija Street Matters
  - *Investment:* Shares/Stocks, Mutual Funds, Land/Properties
  - *Personal Development:* Self-Training, Book Reading (with the book title), Learning Claude, NEBOSH
  
  The user can create unlimited new elements under any category.
- **Goal:** one item that must be accomplished for the element to be complete. Each goal has a **title, start date, due date, and a tick box (done / not done)**.
  - An element has **1 to 10 goals**. Enforce this in the UI **and** with a DB trigger.
  - The goals are created **when the element is created**. The "New element" wizard requires at least one goal. More goals can be added later, up to 10.
  - All goals in an element **weigh equally**. Each goal is worth `100 / N` percent, where N is the number of goals. With 4 goals, each is 25%. With 2 goals and 1 ticked, the element is 50%.
- **Status** belongs to the **element as a group**. Individual goals also carry a display state (done, not started, open, overdue, abandoned) so they can be styled. A goal is **not started** when it is not done and its start date is after today (see §4.6).

### 3.1 Database tables (Postgres, all with RLS `user_id = auth.uid()`)

- `profiles` (id, display_name, timezone default 'Africa/Lagos', theme_preference enum('light','dark','system') default 'system', email_digest_enabled, push_enabled, quiet_hours_start, quiet_hours_end)
- `categories` (id, user_id, key, name, sort_order). Seed the 4 categories on signup.
- `elements` (id, user_id, category_id, name, description, zero_progress_status enum('not_started','started','resource_delay') default 'not_started', is_decommissioned bool, decommissioned_at, recommissioned_at, restarted_at, created_at, updated_at, sort_order)
- `goals` (id, user_id, element_id, title, notes, start_date, due_date, original_due_date, is_done, done_at, reset_count int default 0, created_at, sort_order). Constraint: `due_date >= start_date`.
- `goal_date_resets` (id, goal_id, old_due_date, new_due_date, reason, created_at)
- `status_events` (id, element_id, from_status, to_status, reason, created_at). This is an append-only history that feeds the period comparisons.
- `daily_snapshots` (user_id, snapshot_date, category_id, element_id, pct_complete, goals_total, goals_done, status). A `pg_cron` job writes these every night at 23:55 Africa/Lagos. They power the trend charts.
- `push_subscriptions` (id, user_id, endpoint, keys jsonb, device_label, created_at)
- `notification_log` (id, user_id, goal_id, kind, channel, sent_at). Unique on (goal_id, kind, channel, date) to prevent duplicate alerts.
- `ai_summaries` (id, user_id, period_start, period_end, content_md, model, created_at)

---

## 4. Status engine (the most important logic)

Put all of this in **pure TypeScript functions** in `src/lib/engine/`. Make them fully unit-tested and reusable by the Edge Functions (share the code or mirror it exactly). **Never scatter status logic in components.**

### 4.1 The nine statuses

| Status | How it is set | Colour (pill bg / text) | Notes |
|---|---|---|---|
| Not Started | **Auto** at 0% before the element's start date (§4.6) | Slate `#64748B` | Default for a new element whose start date is in the future |
| Started | **Auto** at 0% from the element's start date (§4.6) | Indigo `#4F46E5` | Start date reached, but no goal ticked yet |
| Resource Delay | **Manual**, only when 0% | Orange `#EA580C` | Flag in advice if it lasts more than 7 days |
| In Progress | **Auto** at 1–99% | Cyan `#0891B2` | |
| Completed | **Auto** at 100% | Green `#16A34A` | Completed goal items use **green text** |
| Abandoned | **Auto** (see 4.3) | Grey `#9CA3AF`, card at **45% opacity** | Faded so it does not clutter the view |
| Restarted | **Auto** after a date reset of an abandoned element | Purple `#9333EA` | Lasts until the next tick change, then normal rules apply |
| Decommissioned | **Manual** switch off | Dark grey `#374151` | Hidden everywhere (see 4.5) |
| Recommissioned | **Auto** when switched back on | Sky `#0284C7` | Lasts until the next tick change, then normal rules apply |

A status is **always shown as a pill with its word and an icon**, never colour alone. Check every pill for WCAG AA contrast.

### 4.2 Resolution order (`resolveElementStatus(element, goals, today)`)

1. If `is_decommissioned`, the status is **Decommissioned**.
2. If the element is abandoned (4.3), the status is **Abandoned**.
3. If `recommissioned_at` is set and no goal has changed since then, the status is **Recommissioned**.
4. If `restarted_at` is set and no goal has changed since then, the status is **Restarted**.
5. If pct = 100, the status is **Completed**.
6. If 0 < pct < 100, the status is **In Progress**.
7. If pct = 0 and **today is before the element's start date** (the earliest `start_date` of its goals), the status is **Not Started** (§4.6).
8. If pct = 0 and the user has marked the element **Resource Delay**, the status is **Resource Delay**.
9. Otherwise (pct = 0, start date reached), the status is **Started**.

Unticking a goal re-runs the engine. For example, Completed goes back to In Progress. Every change in the resolved status writes a row to `status_events`.

### 4.3 Overdue and Abandoned

- **Goal overdue:** the goal is not done and `today > due_date`. Show a red **"Overdue · X days to abandonment"** badge on days 1 to 7 after the due date. The element keeps its normal status but displays the overdue flag.
- **Goal abandoned:** the goal is not done and `today > due_date + 7 days`. The goal row fades (45% opacity, muted text).
- **Element abandoned:** **all** of its unfinished goals are abandoned. If only some goals are abandoned, the element keeps its status and shows a warning, for example "1 goal abandoned".
- Abandoned goals **still count in the % denominator**. Abandoning a goal must never raise the completion %.
- **Date reset** is the only way to make an abandoned goal active again. The reset modal requires a new due date after today and has an optional reason. It writes to `goal_date_resets`, increments `reset_count`, and if the element was Abandoned it sets `restarted_at`, so the element shows **Restarted**.

### 4.4 Percentage

`pct = round(done_goals / total_goals × 100)`. Show it everywhere next to the status, for example "In Progress · 50%".

### 4.5 Decommission and Recommission

- There is a toggle on each element, with a confirmation dialog.
- When an element is decommissioned it is **completely removed** from all charts, KPIs, comparisons, advice lists and notifications. It appears only under **Settings → Archive → Decommissioned**, where it can be switched back on.
- Recommissioning restores the element to every view and sets the status to **Recommissioned**.
- Keep the history. Decommissioning never deletes data.

### 4.6 Future start dates

- A **goal** whose start date is after today (in the user's timezone) and is not done shows the display state **Not Started**. It still counts in the % denominator.
- An **element** whose start date (the earliest `start_date` of its goals) is after today and is at 0% is **automatically Not Started**, whatever `zero_progress_status` says. Example: today is 26 October and every goal starts on 1 November, so the element shows **Not Started**.
- While an element has not reached its start date, the 0% selector is **locked to Not Started** (shown but disabled, with the start date as the reason). Started and Resource Delay cannot be chosen yet.
- **On the start date, an element still at 0% switches to Started automatically.** No user action is needed. The switch is recorded in the status history (`status_events`), like any other status change.
- From the start date onwards, the 0% selector offers **Started** or **Resource Delay** only. Not Started is no longer offered, because the start date has passed. Choosing Resource Delay keeps it until the user switches back to Started or ticks a goal.
- If the user moves the goal dates so the start date is in the future again, the element goes back to **Not Started**.
- A goal ticked before its start date counts as done as usual. Real progress outranks the calendar, so the element then follows the normal rules (for example, **In Progress**).
- The Started and Resource Delay stall checks (§7.1) count days from the later of the start date and the date that status began.

---

## 5. Time bands and colour gradient

Use the **due date of the nearest unfinished goal** to put an **element** into a band. Each **goal** also gets its own band colour from its own due date. `daysLeft = due_date − today`, counted in the user's timezone.

| Band | Days left | Colour at far edge → colour at near edge |
|---|---|---|
| Long Term | 60+ | White `#FFFFFF` (100+ days, clamped) → Dark Grey `#4A4A4A` (60 days) |
| Medium Term | 30–59 | Light Blue `#E3F0FF` (59) → Deep Blue `#0B4FA8` (30) |
| Short Term | 15–29 | Light Amber `#FFF3D6` (29) → Deep Amber `#B86E00` (15) |
| Immediate | 0–14 | Light Red `#FFE0DC` (14) → Deep Red `#B3261E` (0 / due today) |
| Overdue | < 0 | Solid Crimson `#5C0B0B` + red Overdue badge |

**Gradient rule:** inside each band, colour gets **denser and darker as days left approaches the band's lower bound**. At the top of the next band down, a new light colour appears and darkens in the same way. For example, a goal at 59 days is pale blue, at 45 days it is mid blue, and at 30 days it is deep blue. At 29 days it switches to pale amber.

- Implement `bandFor(daysLeft)` and `bandColor(daysLeft): {bg, fg}`. Interpolate in **OKLCH** (use `culori`) so the gradient looks even.
- `fg` (text colour) switches between near-black and white automatically so it always meets WCAG AA contrast against `bg`.
- Use the band colour on: the element card's left edge and header tint, the goal row's date chip, the timeline bars, and the deadline heatmap.
- Completed and decommissioned items do **not** take band colours. Completed items use green.
- Show a small legend of the bands on the dashboard.

---

## 6. Screens

Use a mobile-first layout. On mobile, use a bottom tab bar (Dashboard · Categories · Timeline · Add · Settings). On desktop, use a left sidebar.

### 6.1 Dashboard (home)
1. **"Focus Now" strip at the very top.** Show every overdue and Immediate (0–14 days) goal, sorted by most urgent. Each item has a one-tap tick box and a link to its element. This strip must never be hidden or collapsed by default.
2. **KPI tiles with deltas.** Show overall completion %, goals completed this period, goals due in the next 14 days, overdue count, and abandoned count. Each tile has a sparkline and a ▲/▼ delta against the previous period, coloured for good or bad direction.
3. **Period switcher:** This week vs last week (default) · This month vs last month · This quarter vs last quarter · Custom range.
4. **Progress commentary and advice** (see §7).
5. **Charts** (see §8).
6. **Category cards** (4). Each shows the category %, status distribution, and the next deadline. Tap a card to open the category view.

### 6.2 Category view
- Lists the elements as cards. Each card shows: band-coloured edge, name, status pill + %, progress bar, next due goal, and an overdue or abandoned warning if there is one.
- Filters: status, band, and show/hide completed. Sort by due date, %, or name.
- "+ New Element" button.

### 6.3 Element detail
- Header: name, category, status pill, %, decommission toggle, and the 0% status selector. It is shown only when the element is at 0%: locked to Not Started before the start date, then offering Started or Resource Delay (see §4.6).
- Goal checklist, with up to 10 goals. Each goal row has: tick box, title, start → due dates, band chip with "X days left", and an overdue/abandoned state. Completed goals show **green text**. Abandoned goals are **faded** and have a **"Reset date"** button.
- A mini burndown chart for this element.
- Status history timeline, from `status_events` and `goal_date_resets`.
- Edit, reorder, add or delete goals. Deleting asks for confirmation.

### 6.4 New Element wizard
Step 1: choose a category and name the element. Step 2: add 1–10 goals, each with a title, start date and due date. Validate as you go: the due date must not be before the start date, at least one goal is required, and no more than ten. Step 3: review and save. Offer **quick templates** from the example elements in §3.

### 6.5 Timeline
A Gantt view of all active goals, with bars from start to due date, band-coloured, a "Today" line, and grouping by category → element. It scrolls horizontally on mobile.

### 6.6 Settings
Profile and timezone, notification toggles per channel, quiet hours, a "Send test push" button, the AI summary on/off switch, **Archive** (decommissioned and completed elements), export all data to JSON/CSV, and sign out.

---

## 7. Commentary and advice engine

### 7.1 Rule-based engine (always on, no API cost)
Implement this in `src/lib/engine/advice.ts`. It produces:

- **Overall comment.** A template-driven paragraph. For example: *"This week you completed 6 goals (▲2 vs last week). Overall completion is 48% (▲5 pts). Business is your strongest area at 71%. Investment is lagging at 22% with 2 goals overdue."*
- **Focus Now (Immediate + Short Term).** Overdue goals first, then 0–14 days, then 15–29 days. Rank each by `urgencyScore = f(daysLeft, remaining weight, behind-pace)`.
- **Keep Tabs On (Medium + Long Term).** Elements in the 30+ day bands, flagged only if they are behind pace.
- **Pace check.** `expectedPct = elapsed / (due − start)` across the element's goals. Mark the element **Behind pace** if `actualPct < expectedPct − 15 points`.
- **Stalls.** In Progress with no tick for 14 days or more. Resource Delay for more than 7 days. Started at 0% for more than 7 days.
- **Wins.** Elements completed this period, and the category with the biggest improvement.

### 7.2 AI weekly narrative (optional, layered on top)
- A Supabase Edge Function `ai-summary` receives a **compact JSON summary** containing: categories, elements (names, %, status, band, days left, pace) and the period deltas. Send **no** other personal data.
- The system prompt asks Claude to act as a **direct, encouraging performance coach**. It should name the 3 things to do this week, the 1 risk to watch, and 1 thing to celebrate. Limit it to 180 words, written in plain language.
- It runs automatically every **Monday 07:00 Africa/Lagos** (via `pg_cron`) and on demand with a "Refresh insight" button (rate-limited to 5 per day).
- The result is stored in `ai_summaries` and shown in a card above the rule-based advice, with its date.
- If the API key is missing or the call fails, hide the card quietly and keep showing the rule-based advice.

---

## 8. Charts (meaningful and attractive)

Each chart must answer a clear question. Use the band colours and status colours consistently. Every chart needs a title, tooltips, and readable labels, and must work in both light and dark mode. Each chart should say what it shows in one line.

| # | Chart | Question it answers |
|---|---|---|
| 1 | **Radial gauges** (×4, one per category) + one overall | "How complete is each area of my life?" |
| 2 | **Grouped bar: this period vs last period**, goals completed per category | "Am I doing more or less than before?" |
| 3 | **Line chart: cumulative goals completed**. The current period is a solid line and the previous period is a dashed overlay. | "Is my momentum improving?" |
| 4 | **Stacked horizontal bar: status mix per category** | "Where are things stuck, delayed or abandoned?" |
| 5 | **Deadline calendar heatmap**, covering the next 90 days, cells coloured by band, with goal count in each cell | "When are my crunch periods?" |
| 6 | **Radar: balance across the 4 categories**, current vs previous period | "Am I neglecting an area of my life?" |
| 7 | **Band distribution donut**: Overdue / Immediate / Short / Medium / Long | "How much is urgent right now?" |
| 8 | **Element burndown** (on element detail): remaining goals vs ideal line | "Will I finish this on time?" |
| 9 | **Sparklines** inside the KPI tiles | "Which way is this number trending?" |

Tapping a chart segment should filter or navigate to the matching elements. Decommissioned elements are **excluded from every chart**.

---

## 9. Notifications (core feature)

Send notifications through three channels. Each can be toggled in Settings.

**Schedule.** A `pg_cron` job runs daily at **07:00 Africa/Lagos**, respects quiet hours, and calls the `notify` Edge Function.

| Trigger | Push | Email | In-app |
|---|---|---|---|
| Goal due in 21, 14, 7, 3, 1 days | ✔ | (in digest) | ✔ banner |
| Goal due **today** | ✔ | ✔ | ✔ |
| Overdue, days 1–7 ("X days left before this goal is abandoned") | ✔ daily | ✔ day 1 and day 6 | ✔ red banner |
| Goal/element becomes Abandoned | ✔ | ✔ | ✔ |
| Resource Delay > 7 days or stalled for 14+ days | ✔ weekly | (in digest) | ✔ |
| **Weekly digest** (Monday 07:00): KPIs, deltas, Focus Now list, AI narrative | | ✔ | |

- Use `notification_log` to make sure the same alert is never sent twice.
- Tapping a push notification opens the right element.
- Decommissioned elements never trigger alerts.
- **iOS note:** web push only works when the PWA is **installed to the Home Screen** (iOS 16.4+). Show a one-time install guide on iPhone, and ask for notification permission only after a user gesture.
- In-app: show a badge count on the app icon (Badging API, where supported) and a notification centre panel.

---

## 10. Design and UX

- **Glass UI:** frosted translucent cards using `backdrop-filter: blur()` with a subtle border and inner highlight over a soft gradient background. Use this CSS glass as the default everywhere. Optionally add a Liquid Glass JS effect to the dashboard hero on **desktop only**, and fall back to plain CSS glass on mobile and when `prefers-reduced-motion` is set. Text on glass must still meet WCAG AA contrast.
- Light and dark mode are chosen with a **mode switch** (see §10.1).
- **Readable type:** body text at least 16px, line height about 1.5, tap targets at least 44px, and no horizontal scroll on screens 320px wide.
- Use subtle motion: a tick animation on goal completion and confetti when an element reaches 100%. Respect reduced-motion.
- Use empty states that teach. For example, the first-run dashboard offers the starter templates.
- Accessibility: full keyboard navigation, ARIA labels on charts (plus a table view toggle for screen readers), and status shown with text and not colour alone.

### 10.1 Light / dark mode switch

- Put a **sun/moon toggle switch** in the top bar on desktop and in the header on mobile, so it can be reached from every screen. It flips between **Light** and **Dark** in one tap. Also put it under Settings → Appearance with a third option, **Match system**.
- **First launch:** follow the device setting (`prefers-color-scheme`). Once the user flips the switch, their choice wins until they change it again or pick "Match system".
- **Remember the choice:** save it in `localStorage` for an instant start (wrapped in try/catch) **and** in `profiles.theme_preference`, so it follows the user to their other devices.
- **No flash of the wrong theme:** a tiny inline script in `index.html` reads the saved choice and sets `data-theme="light|dark"` on `<html>` before React loads.
- Build both themes from **CSS variables (design tokens)**, using Tailwind's `darkMode: ['class', '[data-theme="dark"]']`. Do not hard-code colours inside components.
- Everything changes with the theme: glass panels (darker tint and lower-opacity highlight in dark mode), status pills, band colours, chart backgrounds, axes, gridlines and tooltips (re-render ECharts with a light or dark theme object), PWA `theme-color` meta tag, and the in-app banners.
- Band gradient colours (§5) keep the same meaning in both themes. In dark mode, the "far edge" colour of each band is a dark tint, not white, and text contrast is recalculated so AA still passes.
- The switch has an accessible label ("Switch to dark mode" / "Switch to light mode"), works with the keyboard, and animates smoothly unless reduced motion is set.

---

## 11. PWA and offline

- Manifest: name "Progress Tracker", short name "Progress", theme colour, maskable icons at 192/512, `display: standalone`, start URL `/`.
- Installable on Android, iOS and desktop. Show a custom "Install app" prompt.
- Offline: the app shell is precached, the last-loaded data is readable offline from the IndexedDB-persisted query cache, and **ticks and edits made offline are queued and synced** when the connection returns. Show an "Offline · changes will sync" indicator.
- Lighthouse targets: PWA installable ✔, Performance ≥ 90 on mobile, Accessibility ≥ 95.

---

## 12. Security

- RLS on every table. Run a test that one user cannot read another user's rows.
- Store secrets only in Supabase/Vercel env vars: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `VAPID_PRIVATE_KEY`. Only the anon key and VAPID public key reach the client.
- Validate all inputs with `zod`, on both the client and the Edge Functions.

---

## 13. Build phases. Stop after each one, summarise, and tell me what to test.

1. **Scaffold:** connect to the GitHub repo and set up CI (§2.1), load the skills listed for Phase 1 (§2.2), Vite/React/TS, Tailwind, shadcn, light/dark design tokens and the mode switch (§10.1), Supabase client, auth (magic link + Google), DB migrations, RLS, category seeding, link GitHub to Vercel and deploy a skeleton.
2. **Core CRUD + engine:** elements, goals, the wizard, ticks, the status engine, bands and colours, date reset, decommission/recommission, status history. **Vitest coverage ≥ 90% on `src/lib/engine`.**
3. **Dashboard:** Focus Now, KPI tiles, period comparison, `daily_snapshots` cron, all charts in §8, the rule-based advice.
4. **PWA + offline:** manifest, service worker, install prompt, offline queue.
5. **Notifications:** push (VAPID, subscriptions, service worker handler), the `notify` Edge Function, Resend emails, the weekly digest, the in-app notification centre.
6. **AI narrative:** the `ai-summary` Edge Function, the Monday cron, the refresh button, the fallback.
7. **Polish:** glass UI, dark mode, accessibility audit, Lighthouse, Playwright end-to-end tests, README.

---

## 14. Acceptance tests (these must pass)

1. Create the element "PMI 2027" with 4 goals. Tick 1 → **In Progress · 25%**. Tick all 4 → **Completed · 100%** with green goal text. Untick 1 → back to **In Progress · 75%**.
2. An element with 2 goals and 1 ticked → **In Progress · 50%**.
3. A new element at 0% whose start date is today or earlier → **Started** automatically, and the user can switch it to **Resource Delay** and back. The selector is hidden once any goal is ticked.
4. A goal due 3 days ago and not ticked → red **"Overdue · 4 days to abandonment"** badge.
5. A goal due 8 days ago and not ticked → the goal is faded as **Abandoned**. If it is the element's only open goal, the element is **Abandoned**. The % does **not** go up.
6. Reset the date on that abandoned goal → the element shows **Restarted**. After the next tick it follows the normal rules.
7. Band colours: due in 59 days = pale blue, 30 days = deep blue, 29 days = pale amber, 15 days = deep amber, 14 days = pale red, 0 days = deep red, 60 days = dark grey, 100+ days = white. Text contrast passes AA in every case.
8. An element's band uses its **nearest unfinished** goal's due date.
9. Decommission an element → it disappears from every chart, KPI, advice list and notification. Recommission it → it reappears with the status **Recommissioned**.
10. "This week vs last week" deltas are correct against seeded `daily_snapshots` fixtures (with Monday as the week start, in the Lagos timezone).
11. A goal due in 14 days triggers exactly **one** push at 07:00 Lagos, and no duplicate on re-run.
12. An 11th goal cannot be added to an element (UI and DB both block it).
13. The app installs on Android Chrome and iOS Safari (Home Screen), opens offline, and syncs a tick made offline.
14. With no Anthropic key, the app works fully and the AI card is hidden.
15. The mode switch flips Light ↔ Dark on every screen with no flash on reload. The choice is still there after signing in on a second device. Every chart, pill, band colour and glass panel passes AA contrast in both modes.
16. Every phase is on GitHub: a merged pull request, a green CI run, a version tag, and no secrets in the repo history.
17. Today is 26 October. An element whose goals all start on 1 November → **Not Started** automatically, the selector is locked, and each goal shows **Not Started**. On 1 November, with nothing ticked → **Started** automatically, with a Not Started → Started row in the status history. Ticking a goal early (before 1 November) → **In Progress**.

---

## 15. What the owner must provide (ask for these when you reach the phase that needs them)

- Push access to **https://github.com/Ibojie/Progress-Tracker** from the machine running Claude Code, through `gh auth login` or a GitHub credential (Phase 1)
- Supabase project URL and keys (Phase 1)
- Vercel account/project link, and a custom domain if wanted (Phase 1)
- Google OAuth client ID/secret for Google sign-in (Phase 1, optional)
- Resend API key and a verified sending domain (Phase 5)
- Anthropic API key (Phase 6)
- You generate the VAPID keys yourself and tell me where you stored them.

---

## 16. Deliverables

- All source code pushed to **https://github.com/Ibojie/Progress-Tracker**, with one merged pull request and one version tag per phase, and a green CI workflow.
- `CHANGELOG.md` and `.env.example`.
- `README.md` covering setup, env vars, how to run locally, how to deploy, and how to install the app on a phone.
- `DECISIONS.md` listing every assumption you made.
- Supabase migrations and seed scripts, plus Edge Function source.
- Passing Vitest and Playwright suites.
