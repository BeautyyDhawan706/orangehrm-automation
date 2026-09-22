# OrangeHRM Employee Lifecycle Automation

[![CI](https://github.com/BeautyyDhawan706/orangehrm-automation/actions/workflows/ci.yml/badge.svg)](https://github.com/BeautyyDhawan706/orangehrm-automation/actions/workflows/ci.yml)

Automation framework for the Senior QA Automation Engineer technical test.
Automates the full employee lifecycle (auth → create → validate → update →
API-verify → delete) against the [OrangeHRM demo](https://opensource-demo.orangehrmlive.com)
instance, with CI/CD, flaky-test resilience, K6 performance tests, and reporting.

## Stack

| Concern     | Choice                             |
| ----------- | ---------------------------------- |
| Test runner | Playwright Test + TypeScript       |
| Pattern     | Page Object Model (POM)            |
| API checks  | Playwright `APIRequestContext`     |
| CI/CD       | GitHub Actions (sharded, parallel) |
| Performance | k6                                 |
| Reporting   | Playwright HTML + JUnit, k6 HTML   |

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
  utils/                     # waits, test data, API client, logging
tests/
  fixtures/                  # authenticated setup + guaranteed data cleanup
  e2e/                       # independent lifecycle-stage tests
  api/                       # standalone API-layer tests
shared/                      # cross-runtime constants used by Node and k6
k6/                          # performance test scripts
.github/workflows/ci.yml     # CI pipeline
playwright.config.ts         # retries, reporters, parallel projects
```

## Setup

```bash
npm ci
npx playwright install --with-deps chromium
cp .env.example .env.qa.local
# Fill ADMIN_USERNAME and ADMIN_PASSWORD in .env.qa.local.
# This ignored file must remain local and must not be committed.
```

## Execution

```bash
# Full suite (default env = qa)
npm test

# Static quality gate used by CI
npm run quality

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

# K6 performance tests (requires k6 and credential environment variables)
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

**Independent tests with fixture-owned data.** Each lifecycle stage is a
separate test that can run by itself. `buildEmployee()` generates unique data,
and `tests/fixtures/test.ts` API-seeds prerequisites where creation is not the
behavior under test. Every employee ID is registered before the test action;
fixture teardown then deletes it in a `finally` block, including after failed
assertions. Cleanup is idempotent when the delete test already removed it.

**Credentials are injected, never defaulted.** Local credentials belong in an
ignored `.env.<environment>.local` file. CI reads `ORANGEHRM_USERNAME` and
`ORANGEHRM_PASSWORD` repository secrets. Missing credentials fail with a clear
configuration error; application and k6 code contain no credential fallback.

**API setup and verification use the app's own session, not a mocked API.**
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

**Quality checks are executable, not conventional only.** ESLint, strict
TypeScript, and Prettier run together through `npm run quality`, and the CI
test matrix does not start unless that job passes.

**API failures are diagnostic and recoverable.** Failed calls raise a typed
error containing the method, URL, status, and a bounded response excerpt.
Structured logs record setup and cleanup without credentials. Requests retry
at most three times for rate limits or server errors, and one expired session
is re-authenticated before retrying; permanent client errors still fail fast.

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

Tags use Playwright's typed `tag` metadata (`@smoke`, `@regression`, `@api`)
and are filtered with Playwright's built-in `--grep`/`--grep-invert`. A tag is
therefore visible as test metadata rather than being an unchecked title suffix:

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

### Performance thresholds

| Scenario          | Latency thresholds      | HTTP failure rate | Check pass rate |
| ----------------- | ----------------------- | ----------------- | --------------- |
| Login API         | p95 < 2.5s and p99 < 5s | < 1%              | > 99%           |
| Employee creation | p95 < 2.5s              | < 2%              | > 98%           |

The login limits allow moderate network variance on the shared public demo
without accepting a sustained slowdown. A threshold breach intentionally
fails the manually dispatched performance job; it should be investigated or
rerun when the external demo is degraded, not treated as a functional-test
failure. The assignment requires threshold definitions but does not prescribe
specific numeric targets.

## Where to find test reports & build artifacts

These aren't committed to the repo (generated HTML/binary reports don't
belong in git history) — they're produced by CI and downloadable from
**[Actions → any run](https://github.com/BeautyyDhawan706/orangehrm-automation/actions/workflows/ci.yml)**,
under that run's "Artifacts" section:

| Artifact                    | What it is                                               |
| --------------------------- | -------------------------------------------------------- |
| `playwright-report-final`   | The merged HTML report across all 4 shards               |
| `junit-results-<shard>`     | Per-shard JUnit XML                                      |
| `blob-report-<shard>`       | Raw per-shard Playwright report data (merge input)       |
| `failure-artifacts-<shard>` | Screenshots/videos/traces, only present if a test failed |
| `k6-reports`                | k6 HTML + JSON summaries (manual-dispatch runs only)     |

## CI/CD pipeline

`.github/workflows/ci.yml` runs on every push/PR to `main`, plus manual
dispatch:

1. Runs strict TypeScript, ESLint, and Prettier checks.
2. Installs Node dependencies and Playwright browsers.
3. Injects credentials from GitHub repository secrets and runs the suite
   across 4 parallel shards.
4. Uploads each shard's HTML report and failure artifacts (screenshots,
   videos, traces) unconditionally (`if: always()`), so failed runs are
   still debuggable.
5. Merges all shard reports into one `playwright-report-final` artifact.
6. On manual dispatch, runs the K6 performance suite as a separate job.

Before enabling CI, create repository secrets named `ORANGEHRM_USERNAME` and
`ORANGEHRM_PASSWORD`. Secret values are never stored in workflow YAML.

## Notes for the reviewer

Live execution against the shared OrangeHRM demo surfaced several bugs beyond
selector drift, worth calling out since they are the kind of issue that only
appears under real network and SPA timing conditions:

- **Whole-test timeout misconfigured.** `playwright.config.ts` wired the
  per-action wait budget (`DEFAULT_TIMEOUT_MS`, 15s) into Playwright's
  _whole-test_ `timeout`. These budgets are now separate, and all condition
  waits share the environment-driven action timeout.
- **CSRF token extraction wrong.** The login page is client-rendered by
  Vue; the token isn't a form field in the raw HTML (`ApiClient.login()`
  and both k6 scripts were scraping for one) — it's a prop on the
  `<auth-login>` component (`:token="&quot;<token>&quot;"`). The form also
  posts to `/auth/validate`, not `/auth/login`.
- **SPA hydration races.** Clicking an action immediately after a route
  transition (e.g. Add Employee's Save, or editing a field right after
  opening a record) can land before the component has finished mounting or
  the async data fetch has resolved — in the latter case the fetch
  resolving _after_ your edit silently overwrites it. Fixed with explicit
  readiness waits rather than fixed sleeps.
- **Toast/navigation race.** A success toast can appear and disappear while a
  click is still waiting for SPA navigation. Toast and click waits now start
  together with `Promise.all`, so success evidence cannot be missed.
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
- **`/auth/logout` aborts under Playwright.** A direct `page.goto()` to the
  logout URL gets `net::ERR_ABORTED` because the SPA's router intercepts it
  client-side, which looks to Playwright like the navigation being
  cancelled. `LoginPage.logout()` now drives the actual user-menu dropdown
  instead of hitting the URL directly.

The page-object boundary remains action-only: assertions stay in test files,
while setup, teardown, API diagnostics, and shared synchronization live in
their dedicated framework layers.
