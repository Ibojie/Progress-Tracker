# Test plan

Tests are layered: many fast unit tests, some database tests, and (from Phase 7) a few end-to-end tests.

| Area | Type | Where | Target |
|---|---|---|---|
| Status engine (`src/lib/engine`): statuses, resolution order, %, overdue/abandoned, start-date rules, bands and colours | Unit (Vitest) | `tests/unit/engine.test.ts` | ≥ 90% lines and branches, enforced in CI |
| Theme logic, env parsing | Unit | `tests/unit/*.test.ts` | Every branch |
| Schema, RLS, triggers, grants | Database (migrations run in PGlite) | `tests/db/schema.test.ts` | Every security rule and goal rule |
| Screens and flows: wizard, ticks, date reset, decommission | Component and end-to-end (Playwright) | Phase 2 components, Phase 7 E2E | The §14 acceptance flows |

## Engine cases (Phase 2)
- **Dates:** calendar-day arithmetic across months and years; "today" in Africa/Lagos vs UTC around midnight; malformed input.
- **Goal states:** done beats dates; Not Started before the start date; overdue on days 1–7 with days to abandonment; abandoned from day 8.
- **Resolution order (§4.2):** each step beats the ones after it; Restarted/Recommissioned end on the next tick change.
- **Start dates (§4.6):**
  - Not Started before the start date, whatever was chosen.
  - Started automatically from the start date.
  - Resource Delay kept once chosen.
  - An early tick → In Progress.
  - The selector is locked, then offers Started/Resource Delay.
- **Bands (§5):** boundaries; exact edge colours (acceptance test 7); steady darkening; dark-mode far edge; AA text contrast for every day from −10 to 120 in both themes.
- **Pills (§4.1):** label, icon and AA contrast for all nine statuses.
- **Acceptance tests 1–8 and 17** as named tests.

## Notification cases (Phase 5)
- **Alert rules (`tests/db/notifications.test.ts`, real migrations):**
  - Due in 21, 14, 7, 3 and 1 days; due today; overdue days 1–7, with email only on days 1 and 6; abandoned on day 8 only.
  - Element abandoned (once), Resource Delay over 7 days and no ticks for 14 days (weekly).
  - The Monday digest and its figures.
- **Timing:** the 07:00 send hour in each user's own timezone; quiet hours that cover 07:00 delay the send until they end.
- **Never twice:** re-running the same hour or day queues nothing new; claimed deliveries aren't handed out again; failures are retried, then stopped.
- **Switches:** each channel off sends nothing on it; push needs a subscribed device; decommissioned elements and finished goals never alert.
- **Security:** users read only their own alerts and may change only `read_at`; only the service role can queue, claim, read digests or check the scheduler secret.
- **Messages (`tests/unit/notifyMessages.test.ts`):** push payloads, links limited to in-app paths, HTML escaping in emails, digest wording, the VAPID key format.
- **Owner's device tests (acceptance test 11 and §9):** turn on push, Send test push, tap it to open the app; receive the 07:00 alerts and the Monday digest email.

## AI insight and export cases (Phase 6)
- **What the AI sees (`tests/db/aiSummaries.test.ts`):** names and numbers only, with no goal titles, notes, email or ids; each element's %, status, days left, band and pace, most urgent first; switched-off elements left out; the week against the week before.
- **Limits and schedule:** 5 manual refreshes a day in the user's timezone; a Monday insight once per user, after their send hour, only with the switch on and something tracked; the digest picks up its Monday's insight.
- **Security:** users read only their own insights and can't write them; only the server can build the input or check limits and schedule.
- **Format (`tests/unit/insight.test.ts`):** the reply is parsed into headings, actions and sentences; markup, links and tags are stripped; email HTML is escaped; the digest includes the coach's take only when one exists.
- **Export:** CSV quoting and formula protection, row order by area and element, and the UTF-8 marker.
- **Owner's tests (acceptance test 14 and §7.2):**
  - Refresh insight writes a note.
  - The count of refreshes left drops.
  - Switching AI off hides the card.
  - Both exports open correctly.

## End-to-end and launch checks (Phase 7)
- **Playwright (`e2e/app.spec.ts`)** runs at desktop and phone sizes against the in-memory fake Supabase:
  - the sign-in page;
  - the dashboard with the AI card hidden when no key is set (test 14);
  - PMI 2027 moving through In Progress 25%, Completed 100% (with confetti) and back to 75% (test 1);
  - the wizard and the 10-goal limit (test 12);
  - the theme switch surviving a reload (test 15);
  - the skip link and keyboard use;
  - no sideways scrolling at 320px;
  - account deletion.
- **Accessibility:** axe WCAG 2.1 A/AA checks with zero serious or critical issues on every main screen (dashboard, areas, an area, an element, timeline, Settings, the wizard) in light and dark mode.
- **Account deletion (`tests/db/accountDeletion.test.ts`):** it needs the word DELETE and a signed-in user, removes rows from all 11 tables, and leaves other users untouched.
- **Lighthouse (mobile):** Performance at least 90, Accessibility at least 95. Measured 97 and 100 on a production build.
- **Owner's tests:**
  - Delete a **spare test account**.
  - Check the tick pop and the confetti on the phone.
  - A look-and-feel pass in both themes.
