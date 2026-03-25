# Infrastructure considerations

## Project architecture

This repo is **only tests**. The app under test lives elsewhere (today: the public ParaBank demo). 

The tricky part is **one shared database for everyone**. Many tests use the same demo user and fixed account numbers. That works fine when tests run **one at a time**. As soon as you run many tests or CI jobs in parallel against the **same** URL, they step on each other.

A long-term shape:

- **Tests** stay organized like now: shared steps, shared API helpers, one place for constants (can be split later if needed)
- **Data** should either be **unique per test** (register a user in the test, read IDs from the API) or each run should hit **its own copy** of ParaBank (see Docker below).
- **Constants** with hard-coded IDs are simple for a demo but brittle if the vendor changes seed data or if many people hit the same DB at once.

---

## Configuration management

Today, things like the base URL are fixed in config. For teams and CI, it’s better to **drive the same code with settings**:

- Use **environment variables** (and optionally a local `.env`) for the bank URL, any login used in tests, and similar values.
- Keep a **example env file** (` .env.example`) in the repo that lists every variable with dummy or safe values so new people know what to set.
- In **CI**, inject those values through the pipeline’s secrets / environment settings, not by committing real credentials.
- One “default” public URL can stay as a fallback for people who don’t host their own ParaBank.

That way local dev, staging, and isolated Docker runs all use the **same** tests with **different** targets.

---

## Reporting and debugging

Playwright already builds an **HTML report** after runs. What matters for infrastructure:

- **On failure (especially after a retry)** keep useful extras: **traces**, **screenshots**, and maybe **short videos**. They cost disk but save hours when something flakes.
- **Upload** the report folder and test-result folder from CI to shared storage (like s3)
- Add a **machine-readable** report type (for example JUnit XML), some CI tool shows test history and trends in its own UI.

Locally, **debug mode** and **UI mode** (already in `package.json`) tools for stepping through a single test.

---

## CI implementation

A typical CI job would:

1. Install **Node** at the version the project expects.
2. Run **`npm ci`** so installs match the lockfile.
3. Install Playwright **browsers** 
4. Set **`CI=true`** (or equivalent) so “no `test.only`” and **retries** behave as intended.
5. Run **`npm test`**. This project intentionally runs **one worker** against a shared demo to reduce DB clashes.
6. **Always** upload reports and test results—even on failure

You can **split the suite by purpose** and **run each part on a different cadence**. For example, run a **smoke** slice (tiny “is the app up and can we log in?”) on every commit or PR. Run **component** or **API-only** checks more often. Run the **full end-to-end journey** less often (nightly or on merge to **main**). Run **negative** or edge-case tests on a schedule or before releases. This repo already has npm scripts for slices (full run, single journey, API, component, negative)—you map those to jobs or cron in your CI. The tradeoff stays the same: faster PR feedback versus fuller coverage later. If several jobs hit the **same** shared demo **at once**, you can still get DB clashes unless you isolate environments or data.

**Parallel CI** is safe only if each job uses **its own** ParaBank (or **its own** data strategy). Splitting “API job” vs “UI job” against the **same** public demo does **not** fix collisions by itself if they both reset or mutate the same user.

---

## Dockerization

Docker here is mainly for **running your own ParaBank** (app + DB in one place).
- A **compose file** can start ParaBank (official image is available), wait until the app responds, then you run tests from your machine or from CI with `BASE_URL` pointing at **localhost** or the container hostname.

**Benefits:** no reliance on the public demo being up, no strangers sharing your DB, you can pin a ParaBank version so seed data stays predictable, and **multiple CI jobs** can each get their **own** stack and safely use more parallelism.

**Still true:** even with Docker, if every test assumes the same `john` user and the same IDs, you need either **serial** runs or **refactored** tests that don’t fight over one narrative of data.

---

## Summary

| Area | Idea |
|------|------|
| Architecture | Tests-only repo. Isolate **data** or **environment** before scaling workers or parallel CI. |
| Configuration | Env vars and optional `.env`. Use CI secrets. Never commit secrets to git. |
| Reporting | HTML, artifacts, and traces on failure. Optional JUnit for CI dashboards. |
| CI | Repro installs, `CI` flag, upload artifacts always. Optional **smoke / E2E / negative** (and similar) on different schedules. Parallel only with isolated backends or safe test data. |
| Docker | Host ParaBank (and optionally the test runner) for repeatability and true parallel pipelines. |
