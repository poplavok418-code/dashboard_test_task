# 03 Visualization Choice Implementation Report

## Implemented Features

- Added `03_visualization_choice` release spec.
- Added a Node CLI that accepts sheet files and prints only the `suggested_visualization` block.
- Added compact sheet profiling for CSV, semicolon CSV, TSV, XLSX, XLS, and ODS where the workbook parser is available.
- Added deterministic chart candidate generation before the LLM call.
- Added NeuralDeep/OpenAI-compatible chat-completions integration:
  - default endpoint: `https://api.neuraldeep.ru/v1/chat/completions`
  - default model: `gpt-oss-120b`
  - default temperature: `0.2`
- Added root `.env` placeholder for secrets and model settings.
- Added automated tests with a local mocked LLM endpoint.
- Added fixtures covering every supported visualization enum.
- Copied the `02_input_preprocessing` Next.js browser page into `03_visualization_choice`.
- Added Next.js package scripts and dependencies to the `03` package while preserving the CLI `choose` script.
- Added browser regression tests for the copied Russian data-loader page.
- Replaced the accepted-file browser details/checklist/summary with a compact visualization type decision while keeping error states intact.

## Files And Folders Created

- `.env`
- `specs/03_visualization_choice/visualization_choice_spec.md`
- `specs/03_visualization_choice/implementation_report.md`
- `versions/03_visualization_choice/`
- `tests/03_visualization_choice/`
- `tests/03_visualization_choice/test_cases/`
- `versions/03_visualization_choice/app/`
- `versions/03_visualization_choice/components/`
- copied browser preprocessing TypeScript utilities under `versions/03_visualization_choice/lib/`
- `tests/03_visualization_choice/browser-page.spec.ts`

## Test Commands Run

```powershell
node --check versions/03_visualization_choice/index.mjs
node --check versions/03_visualization_choice/lib/env.mjs
node --check versions/03_visualization_choice/lib/sheet-parser.mjs
node --check versions/03_visualization_choice/lib/dataset-context.mjs
node --check versions/03_visualization_choice/lib/llm-client.mjs
node --check versions/03_visualization_choice/lib/response-parser.mjs
node --check tests/03_visualization_choice/visualization-choice.test.mjs
npm install --offline
npm run typecheck
powershell -ExecutionPolicy Bypass -File tests/03_visualization_choice/run_03_visualization_choice_tests.ps1 -BaseUrl http://localhost:3000 -PagePath /
npm run build
npm run dev -- --port 3000
```

## Test Results

- Total automated tests: 5
- Passed: 5
- Failed: 0

Final test output:

```txt
✔ prints only suggested_visualization for every supported visualization type
✔ fails clearly when the API key is missing
tests 2
pass 2
fail 0

Running 3 tests using 1 worker
ok 1 browser page opens into the Russian data-loader experience
ok 2 browser page accepts a CSV file and shows only the visualization decision
ok 3 browser page rejects unsupported files with a Russian error
3 passed
```

## Issues And Fixes

- Initial test run hung because the mock LLM server was hosted in the same Node test process while the test used synchronous child-process execution. The synchronous child blocked the event loop, so the mock server could not respond. Fixed by switching the CLI test helper to async `spawn`.
- The mock server was hardened to return a 500 response on internal assertion errors instead of leaving the CLI waiting.
- The LLM client was changed from `fetch` to explicit `http`/`https` requests with `Connection: close`, making CLI process lifetime more predictable.
- The `03` package originally only contained the CLI. It now includes the copied `02` browser app, merged package scripts, and local dependencies installed with `npm install --offline`.
- After running a production build while the dev server was alive, Next.js showed a dev manifest/runtime overlay error on `/`. Fixed by stopping only the `03` dev-server process cluster and clearing the generated `versions/03_visualization_choice/.next` cache. A clean dev restart returned `/` with HTTP 200 and browser tests passed.

## Known Limitations

- Real LLM calls were not executed in automated tests; they use a mocked LLM endpoint.
- Workbook parsing uses the `xlsx` package. In tests, the runner points `NODE_PATH` at the dependency already installed for `02_input_preprocessing`.
- The CLI performs minimal response validation. It checks and normalizes `suggested_visualization`, but full renderer-side validation should still happen before chart creation.
- Ambiguous choices such as `pie_chart` versus `donut_chart` remain model-driven and should be validated against deterministic chart candidates.
- The browser page uses a local deterministic visualization choice for the accepted-state preview. The CLI remains the LLM-backed path and the page does not yet render the selected chart.
