# 08 Task Corrections Implementation Report

## Implemented Features

- Created `versions/08_task_corrections` from the `07_color_change` baseline.
- Added a separate `NarrativeHero` block for the AI narrative hero.
- Updated insight prompting and local fallback behavior toward 2-3 sentence summaries.
- Added deterministic dashboard composition for 1-3 visualization widgets, preferring 2-3 when reliable sheet candidates exist.
- Updated `LoaderResultPanel` to render hero, loading skeletons, chart grid, and existing ask-the-data chat.
- Added explicit chat guardrail wording: `В этом отчете нет такой информации.`
- Refreshed the version README.
- Added `08_task_corrections` static and browser test coverage.

## Files And Folders Created

- `specs/08_task_corrections/task_corrections_spec.md`
- `specs/08_task_corrections/implementation_report.md`
- `tests/08_task_corrections/task-corrections.test.mjs`
- `tests/08_task_corrections/browser-task-corrections.spec.ts`
- `tests/08_task_corrections/run_08_task_corrections_tests.ps1`
- `tests/08_task_corrections/test_cases/`
- `versions/08_task_corrections/`

## Checks Run

From `versions/08_task_corrections`:

```powershell
npm run typecheck
npm run build
```

From the repository root:

```powershell
.\tests\08_task_corrections\run_08_task_corrections_tests.ps1 -SkipBrowser
.\tests\08_task_corrections\run_08_task_corrections_tests.ps1 -BaseUrl http://localhost:3000
```

## Results

- Typecheck: passed.
- Production build: passed.
- Non-browser tests: 4 total, 4 passed, 0 failed.
- Full `08_task_corrections` test runner: 8 total, 8 passed, 0 failed.

## Issues And Fixes

- `versions/08_task_corrections` initially had no `node_modules`, so `npm run typecheck` could not find `tsc`.
- A direct dependency copy was too slow and was stopped.
- Fixed by replacing the partial dependency copy with a junction from `versions/08_task_corrections/node_modules` to `versions/07_color_change/node_modules`.
- Initial user-run browser tests hit a stale `localhost:3000` Node listener serving the older single-chart UI, so `data-testid="narrative-hero"` was absent.
- Fixed by stopping only the stale Node process listening on `3000`, starting `versions/08_task_corrections` on `3000`, verifying HTTP 200, and rerunning the full test runner.

## Known Limitations

- Chat still uses compact profile/sample/text chunks rather than full-file vector RAG.
- Text-only input may produce a hero and chat without forced numeric charts.
- Browser tests require `http://localhost:3000` to be served from `versions/08_task_corrections`; stale listeners from older versions will fail the hero/grid assertions.
