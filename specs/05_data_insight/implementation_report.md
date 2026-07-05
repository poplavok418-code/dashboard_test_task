# 05 Data Insight Implementation Report

## Implemented Features

- Created `05_data_insight` from the `04_sheet_visualizations` baseline.
- Added `prompts/insight_agent_prompt.md` with required structured output:
  - `reasoning`
  - `insight`
- Added a compact insight context for sheet data with local candidate findings, numeric summaries, categorical summaries, warnings, and bounded samples.
- Added deterministic browser insight generation so the UI can show a Russian narrative without exposing the API key client-side.
- Added a browser-facing backend route, `POST /api/analyze`, that keeps `NEURALDEEP_API_KEY` server-side and returns LLM insight/visualization results when available.
- Updated the browser page to call `/api/analyze` with compact contexts, then replace the local insight and visualization with LLM output when the route succeeds.
- Added an explicit fallback warning when LLM output is not used, so local deterministic analysis is clearly labeled.
- Added LLM CLI insight mode using the same NeuralDeep-compatible API contract and `NEURALDEEP_API_KEY`.
- Displayed the insight text in the graph panel header above the rendered graph at `data-testid="data-insight"`.
- Preserved inherited chart rendering, unsupported-file errors, and full-row graph data behavior.

## Files And Folders Created

- `specs/05_data_insight/data_insight_spec.md`
- `specs/05_data_insight/implementation_report.md`
- `prompts/insight_agent_prompt.md`
- `tests/05_data_insight/`
- `tests/05_data_insight/test_cases/`
- `tests/05_data_insight/data-insight.test.mjs`
- `tests/05_data_insight/browser-data-insight.spec.ts`
- `tests/05_data_insight/run_05_data_insight_tests.ps1`
- `versions/05_data_insight/`
- `versions/05_data_insight/lib/data-insight.ts`
- `versions/05_data_insight/lib/insight-context.mjs`
- `versions/05_data_insight/lib/insight-response-parser.mjs`
- `versions/05_data_insight/app/api/analyze/route.ts`

## Main Implementation Changes

- `LoaderResultPanel` now builds a local insight from the best sheet dataset and passes it into `VisualizationPanel`.
- `LoaderResultPanel` now posts compact sheet contexts to `/api/analyze` and falls back to local analysis if the LLM request fails.
- `LoaderResultPanel` now shows `data-testid="llm-fallback-warning"` when the LLM output is unavailable or rejected.
- `/api/analyze` loads prompts server-side, reads the repo `.env` into server env when needed, calls the NeuralDeep-compatible chat completions endpoint, and validates both insight and visualization JSON.
- `VisualizationPanel` now renders the insight in the chart header area using `data-testid="data-insight"`.
- `index.mjs` now supports `--mode insight`; visualization mode remains the default.
- `llm-client.mjs` now includes `callInsightAgent`.
- `package.json` and `package-lock.json` were updated to identify the `05_data_insight` package.
- `package.json` dev script was changed to plain `next dev` because Turbopack rejects the local dependency junction.
- `versions/05_data_insight/node_modules` is a local junction to the existing `04_sheet_visualizations/node_modules` install, avoiding a duplicate dependency tree.

## Commands Run

```powershell
node --test tests\05_data_insight\data-insight.test.mjs
npm run typecheck
npm run build
npm run start -- -p 3005
tests\05_data_insight\run_05_data_insight_tests.ps1 -BaseUrl http://localhost:3005 -PagePath /
npm run dev -- --port 3005
Invoke-WebRequest -Uri http://localhost:3000/api/analyze -UseBasicParsing -Method POST -ContentType 'application/json' -Body '{}' -TimeoutSec 10
npm run start -- -p 3000
tests\05_data_insight\run_05_data_insight_tests.ps1 -BaseUrl http://localhost:3000 -PagePath /
```

## Test Results

- Insight parser and CLI tests: 4 passed, 0 failed.
- Browser data-insight tests: 4 passed, 0 failed.
- Browser data-insight tests after explicit fallback warning: 5 passed, 0 failed.
- Typecheck: passed.
- Production build: passed.
- Final automated runner total: 8 passed, 0 failed.
- Current handoff server: `http://localhost:3000`, verified with HTTP 200.

## Issues And Fixes

- First typecheck attempt failed because `05_data_insight` had no dependency install after copying source without `node_modules`.
- Fix: added a local `node_modules` junction to the existing `04_sheet_visualizations` dependency install.
- First production build attempt completed but warned that `buildLocalInsight` was not exported.
- Cause: the browser import `@/lib/data-insight` collided with a CLI helper named `data-insight.mjs`.
- Fix: renamed the CLI helper to `insight-context.mjs` and updated `index.mjs`.
- `next dev --turbo` failed because Turbopack rejected the `node_modules` junction.
- Fix: changed `05_data_insight` to plain `next dev`; verified that it reaches ready on port `3005`. Browser verification used the successful production build plus `next start -p 3005`.
- After adding `/api/analyze`, the dev server on `3000` returned the known stale runtime `Cannot read properties of undefined (reading 'call')`/missing chunk errors after a build.
- Fix: stopped the stale `3000` process, rebuilt with no server mutating `.next`, and restarted the current built app with `npm run start -- -p 3000`.

## Known Limitations

- Browser insights and visualization choices now attempt live LLM inference through `/api/analyze`, then fall back to deterministic local output if the API key, network request, or JSON validation fails.
- Fallback is visibly labeled with a warning: "LLM сейчас не использован."
- The local insight engine is intentionally lightweight: it focuses on shape, category concentration, numeric range, grouped numeric leaders, and warnings.
- The LLM prompt asks for five sentences, but fallback text is deterministic when the server route cannot return a usable LLM insight.

## Next Steps

- Add clearer UI distinction between full LLM success, partial LLM success, and local fallback.
- Add richer trend and outlier candidates after date handling is expanded.
