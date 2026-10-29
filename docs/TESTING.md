# Testing Worlds Beyond

## Locally

Run `npm install`, then `npx playwright install chromium`, then `npm test`. The browser suite starts a local static server on port 4173 automatically. To run only one suite use `npm run test:unit` or `npm run test:e2e`. The tests use real Chromium and a **fresh browser profile per test**; no real Supabase account or network requests are required. HTML/JS changes can be checked offline.

## Continuous integration

`.github/workflows/ci.yml` runs for **every pull request** and pushes to `main`:
- Unit/contract tests: auto-discovers every `tests/*.test.cjs` (rather than a hard-coded list), plus syntax checks for every `js/*.js`.
- Browser tests: launches Chromium with Playwright and a local `python3 -m http.server`. Clicks the actual Character Sheet/DM Room to verify resources, abilities/AP/cooldowns, form/gear/resources, timed status expiry, JSON export/import, DM import+movement and five mobile routes at 390px.
- On failure, the GitHub Actions run uploads screenshots and trace files in `playwright-failure-report`.

These browser tests are an initial regression baseline, not exhaustive gameplay coverage. Replace brittle source-text assertions with interaction tests over time. Keep cloud and online session integration separate from isolated, deterministic tests. Do not weaken assertions just to pass CI; when a test finds a real UI bug, fix the UI in a separate targeted change.
