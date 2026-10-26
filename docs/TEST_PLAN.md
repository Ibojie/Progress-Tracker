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
