# OrangeHRM Employee Lifecycle Automation

Automation framework for the Senior QA Automation Engineer technical test.
Automates the full employee lifecycle (auth → create → validate → update →
API-verify → delete) against the [OrangeHRM demo](https://opensource-demo.orangehrmlive.com)
instance, with CI/CD, flaky-test resilience, K6 performance tests, and reporting.

## Stack

| Concern         | Choice                                  |
|-----------------|------------------------------------------|
| Test runner     | Playwright Test + TypeScript             |
| Pattern         | Page Object Model (POM)                  |
| API checks      | Playwright `APIRequestContext`           |
| CI/CD           | GitHub Actions (sharded, parallel)       |
| Performance     | k6                                       |
| Reporting       | Playwright HTML + JUnit, k6 HTML         |

Playwright was chosen over Selenium/WebdriverIO for this test because retries,
screenshot/video/trace capture on failure, parallel sharding, and HTML
reporting are all first-class, configuration-driven features rather than
things that need to be hand-built — which keeps the framework code focused
on the actual test logic.

## Project structure

```
src/
  config/env.ts              # environment-based configuration (.env.<env>)
  pages/                     # Page Object Model classes (one per screen)
  utils/                     # waits, test data factory, API client
tests/
  e2e/                       # UI + full-lifecycle tests
  api/                       # standalone API-layer tests
k6/                          # performance test scripts
.github/workflows/ci.yml     # CI pipeline
playwright.config.ts         # retries, reporters, parallel projects
```

## Setup

```bash
npm ci
npx playwright install --with-deps chromium
cp .env.example .env.qa   # already provided; edit if pointing at your own instance
```

## Execution

```bash
# Full suite (default env = qa)
npm test

# Just the E2E lifecycle test
npm run test:e2e

# Just the API suite
npm run test:api

# Against a named environment
npm run test:staging

# Run a tagged subset (see Tagging strategy below)
npx playwright test --grep @smoke

# Parallel, explicit worker count
npm run test:parallel

# View the last HTML report
npm run report

# K6 performance tests (requires k6 installed locally)
npm run perf:login
npm run perf:employee-create
```

## Key design decisions

**Environment config over hardcoded values.** `src/config/env.ts` loads
`.env.<ENV>` (default `qa`), so the same test code runs against QA, staging,
or CI just by changing one variable — no code edits, no duplicated suites.

**POM with no assertions inside page objects.** Page classes expose actions
(`login()`, `save()`, `updateMiddleName()`) and locators only. Assertions
live in the test files. This keeps failures readable — a failed `expect()`
points at the test intent, not a buried helper — and keeps page objects
reusable across both positive and negative-path tests.

**Test data generated per run, not fixed fixtures.** `buildEmployee()`
suffixes names/IDs with a timestamp + random number, so parallel workers and
repeated CI runs never collide on "employee already exists" errors. This is
also what makes safe parallelization possible without a shared test database
or serialized execution.

**API verification via the app's own session, not a separate mocked API.**
Because the demo app's internal API is session-cookie authenticated rather
than token authenticated, `ApiClient` replays the same login flow the UI
uses, then hits the underlying REST endpoint directly. This proves the
employee created through the UI is actually persisted server-side, not just
rendered client-side — a stronger check than re-reading the same page.

**Sharded CI over a single long-running job.** The GitHub Actions workflow
splits the suite across 4 shards (`--shard=N/4`) that run as parallel matrix
jobs, then a `merge-reports` job collects every shard's HTML report into one
final artifact. This keeps CI wall-clock time roughly constant as the suite
grows, rather than degrading linearly.

## Flaky test detection & mitigation strategy

**Detection.**
- Playwright's `retries` setting (2 in CI) automatically re-runs a failing
  test; a test that fails once and passes on retry is flagged as flaky in
  the HTML/JUnit report rather than being reported as a hard failure or a
  silent pass. Tracking that "passed on retry" count over time is what
  surfaces flaky tests, distinct from broken ones.
- `trace: 'on-first-retry'` captures a full execution trace only when a
  retry happens, so we get rich debugging data (DOM snapshots, network,
  console) specifically for the intermittent cases, without paying that
  overhead on every green run.
- Tagging tests (`@smoke`, `@regression`, `@api`) makes it possible to run
  the smallest reliable subset first on every push, and reserve the full
  regression tag set for scheduled/nightly runs where a slower, more
  thorough retry budget is acceptable.

**Mitigation.**
- Condition-based waits (`waitForSpinnerGone`, `waitForToast`) replace fixed
  `sleep()` calls, so tests wait for the actual state the app signals
  (spinner detached, toast visible) instead of an arbitrary duration that is
  either too short (flaky) or too long (slow).
- Unique, per-run test data (see above) removes the most common source of
  "flaky" failures in shared environments: two tests or two runs colliding
  on the same record.
- Screenshots (`only-on-failure`) and videos (`retain-on-failure`) are
  captured automatically, so a flaky failure that can't be reproduced
  locally still leaves visual evidence of what the app actually rendered at
  the moment of failure.
- Locators favor role- and label-based queries (`getByRole`, label-relative
  `input` lookups) over brittle CSS index chains, which reduces failures
  caused by unrelated layout/style changes rather than genuine app defects.

## Tagging strategy

Tags are appended to test titles (`@smoke`, `@regression`, `@api`) and
filtered with Playwright's built-in `--grep`/`--grep-invert`:

```bash
npx playwright test --grep @smoke        # fast, must-pass-every-push subset
npx playwright test --grep @regression   # full suite, e.g. nightly
npx playwright test --grep-invert @api   # UI-only run
```

## Reporting & observability

- **HTML report** (`playwright-report/`) — visual, includes screenshots,
  videos, and traces inline; published as a CI artifact and merged across
  shards.
- **JUnit XML** (`test-results/junit-results.xml`) — for CI dashboards /
  test-management integrations that consume JUnit.
- **K6 HTML + JSON summaries** (`k6-reports/`) — threshold pass/fail plus
  latency percentiles for the two load-tested endpoints.

## CI/CD pipeline

`.github/workflows/ci.yml` runs on every push/PR to `main`, plus manual
dispatch:

1. Installs Node dependencies and Playwright browsers.
2. Runs the suite across 4 parallel shards.
3. Uploads each shard's HTML report and failure artifacts (screenshots,
   videos, traces) unconditionally (`if: always()`), so failed runs are
   still debuggable.
4. Merges all shard reports into one `playwright-report-final` artifact.
5. On manual dispatch, runs the K6 performance suite as a separate job.

## Notes for the reviewer

The full suite (E2E lifecycle + API tests) has been run and verified green
against the live OrangeHRM demo, including sharded blob-report merging
locally to validate the CI pipeline's report-merge step before trusting it
in Actions. That pass surfaced several real bugs beyond selector drift,
worth calling out since they're the kind of thing that only shows up under
live execution rather than code review:

- **Whole-test timeout misconfigured.** `playwright.config.ts` wired the
  per-action wait budget (`DEFAULT_TIMEOUT_MS`, 15s) into Playwright's
  *whole-test* `timeout`, which is nowhere near enough for a 6-step
  lifecycle test against a real remote instance. Decoupled into its own
  60s budget.
- **CSRF token extraction wrong.** The login page is client-rendered by
  Vue; the token isn't a form field in the raw HTML (`ApiClient.login()`
  and both k6 scripts were scraping for one) — it's a prop on the
  `<auth-login>` component (`:token="&quot;<token>&quot;"`). The form also
  posts to `/auth/validate`, not `/auth/login`.
- **SPA hydration races.** Clicking an action immediately after a route
  transition (e.g. Add Employee's Save, or editing a field right after
  opening a record) can land before the component has finished mounting or
  the async data fetch has resolved — in the latter case the fetch
  resolving *after* your edit silently overwrites it. Fixed with explicit
  readiness waits rather than fixed sleeps.
- **Employee Name search silently no-ops on free text.** The autocomplete
  field only actually filters once a suggestion is selected; typing a name
  without selecting it falls through to an unfiltered list rather than
  erroring, which is worse than a flaky failure because it looks like a
  passing assertion on the wrong data. Now requires the suggestion, and the
  "confirm employee was deleted" check searches by Employee Id instead,
  since a deleted record can never have a matching suggestion to select.
- **Stale search request race.** The employee list fires an unfiltered
  request on load; if that request is still in flight when a filtered
  search is triggered, a slower initial response can resolve second and
  clobber the filtered result. Fixed by waiting for the specific filtered
  API response rather than just the loading spinner.
- **API 422 on an intentionally-empty filter.** `GET .../pim/employees`
  rejects `nameOrId=` (empty string) as an invalid parameter instead of
  treating it as "no filter" — `ApiClient.getEmployeeById()` now omits the
  param entirely when unset.

None of this changes the architecture, POM boundaries, or CI wiring — it's
exactly the class of bug that live-running a suite against a real target is
supposed to catch before a reviewer does.
