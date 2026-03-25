# ParaBank — Playwright E2E & API tests


## Setup

1. **Node.js** — **v25.2.1** (validated on this project; newer 25.x or other compatible releases may also work).
2. From the repo root:

   ```bash
   npm install
   npx playwright install
   ```

   `npm install` pulls **devDependencies** including `fast-xml-parser` (used to read ParaBank XML in tests).  
   (Minimal browsers for this repo: `npx playwright install chromium` — see [Playwright docs](https://playwright.dev/docs/cli#install-browsers).)

---

## Execution

| Command | Purpose |
|--------|---------|
| `npm test` | Full suite — **`--workers=1`** so the shared ParaBank DB is not hit by parallel tests |
| `npm run test:e2e` | Single full journey (also `--workers=1`) |
| `npm run test:api` | API-only (`--workers=1`) |
| `npm run test:component` | Tests tagged `@component` (`--workers=1`) |
| `npm run test:negative` | Only **`@negative`** error-path tests (project requirement / clarity; `--workers=1`) |
| `npm run test:parallel` | **Not recommended:** runs Playwright default worker count without `--workers=1` — see [How to scale it](#how-to-scale-it) |
| `npm run test:ui` | Playwright UI mode |
| `npm run test:debug` | Step-through debugging |
| `npm run report` | Open the last HTML report (`playwright-report/`) |
| `npm run create:checking` | Sample `POST /createAccount` via `curl` |

**CI:** when `CI` is set, `forbidOnly` is on and failed tests get retries (see [`playwright.config.ts`](playwright.config.ts)).

**Parallel runs:** this project defaults to **`workers: 1`** (config + npm scripts); see [How to scale it](#how-to-scale-it) for why parallel runs need isolation and what options exist.

---

## Design decisions

1. **Hosted SUT** — `use.baseURL` targets ParaBank; no app server is started from this repo.
2. **Global seed** — [`global-setup.ts`](global-setup.ts) calls `cleanDB` then `initializeDB` before the run.
3. **Per-spec resets** — [`tests/e2e/support/db.helpers.ts`](tests/e2e/support/db.helpers.ts) exposes `resetDemoDatabase()` for flows that require a known `john` / `demo` seed.
4. **Shared steps** — [`tests/e2e/support/journey-steps.ts`](tests/e2e/support/journey-steps.ts) keeps UI/API flows in one place for the journey and component specs.
5. **API expectations** — [`tests/e2e/support/api-assertions.ts`](tests/e2e/support/api-assertions.ts) centralizes HTTP status and XML-shape checks.
6. **Seed data & XML** — [`tests/e2e/support/parabank.constants.ts`](tests/e2e/support/parabank.constants.ts) holds URLs, demo credentials, and seeded ids. ParaBank XML responses are parsed with [**fast-xml-parser**](https://www.npmjs.com/package/fast-xml-parser) (`firstXmlId`, `balancesByAccountIdFromAccountsXml`) instead of hand-rolled regex.
7. **Chromium first** — one Playwright project enabled; more browsers can be uncommented in config.
8. **`@component`** — marks slice tests for filtered runs (`npm run test:component`).
9. **Negative / error paths** — REST: [`api.parabank.spec.ts`](tests/e2e/api.parabank.spec.ts) nested `errors` describes; UI: failed login in [`ui.login.spec.ts`](tests/e2e/ui.login.spec.ts), invalid/empty transfer amounts in [`ui.transfer-funds.spec.ts`](tests/e2e/ui.transfer-funds.spec.ts). Those blocks/tests carry **`@negative`** (and **`@component`** where applicable) so you can run **`npm run test:negative`** for review / assignment demos. **Note:** many of those API cases are asserted as **400** because that is what ParaBank returns today. for unknown customers, accounts, or similar “not found” situations, **404** would usually be the more appropriate status.

---

## Tradeoffs

| Choice | Benefit | Cost |
|--------|---------|------|
| Public ParaBank | Nothing to deploy | Shared DB with the world; depends on remote availability |
| Hard-coded seed ids | Simple assertions | Suite breaks if the vendor changes initialize data; all tests target the same customer |
| `cleanDB` / `initializeDB` | Predictable start | Extra latency; must not overlap unsafely across workers on the same DB |
| Curl for `createAccount` in code | Explicit subprocess / script parity | Slightly harder to diagnose than `APIRequestContext.post` |
| `workers: 1` | Stable against one shared demo | Longer wall-clock than multi-worker CI on an isolated stack |

---

## Assumptions

1. Outbound **HTTPS** to `https://parabank.parasoft.com` works from the runner.
2. After **`initializeDB`**, the public demo still provides **`john` / `demo`**, customer **`12212`**, and the account ids documented in `parabank.constants.ts` (re-check via [Swagger UI](https://parabank.parasoft.com/parabank/api-docs/index.html) if behaviour drifts).
3. **UI tests** need a downloaded browser (project uses **Chromium**). Use the command at the top of this file or step 2 under **Setup** — it is not installed automatically with `npm install` alone.
4. No `.env` is required for the default flow (optional dotenv wiring is commented in `playwright.config.ts`).

---

## How to scale it

This suite targets **one** ParaBank backend (today: the public demo). Many tests **reset the DB**, **log in as the same seeded user**, and **transfer or open accounts** on the same customer and account ids.

If you turn on **multiple Playwright workers** or **several CI jobs** that all hit **that same URL**, those actions **overlap in time** on **one database**: a reset or another test’s transfer can invalidate what a parallel test assumed. 

You can scale in three directions:

1. **Isolate data on one instance** — Keep a **single** server but run **parallel workers** safely by **not sharing `john` / fixed ids across workers**: e.g. **register a new user per test (or per worker)** and drive flows from **API-discovered** customer and account ids, or use **pre-created** test users partitioned per worker. (This repo is oriented toward the shared seed; adopting this means refactoring constants and setup.)

2. **Isolate environments** — Run Playwright against **separate ParaBank setups** so each process has its **own app + database**: e.g. **Docker Compose** or **Kubernetes** (one deployment or `Job` **per pipeline job** or **per worker group**), set **`baseURL`** (and any URLs in `global-setup` once you move them to config/env) to that host, then you can raise **`workers`** or run **multiple jobs in parallel** without cross-talk.

3. **CI** — **Splitting the workflow** (one job for API tests, another for E2E) **does not** by itself fix contention if **every job still uses the same public demo**. For parallel CI you need either **different URLs** (option 2) or **strict data separation in the tests** (option 1). Otherwise keep **`workers: 1`** and accept serialized runs against the shared host, or run only **non-mutating** slices against it.


