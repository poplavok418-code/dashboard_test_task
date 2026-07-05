# 04 Sheet Visualizations Implementation Report

## Implemented Features

- Created `04_sheet_visualizations` from the `03_visualization_choice` baseline.
- Added a browser renderer for the `suggested_visualization` contract.
- Added chart/table/KPI/no-chart rendering after a user uploads a supported sheet file.
- Updated chart rendering so plots are built from all parsed sheet rows, while preview/sample rows remain separate.
- Switched the local `dev` script to `next dev --turbo` after the webpack dev server hit a Next client-manifest runtime error.
- Added graph data preparation for:
  - `bar_chart`
  - `line_chart`
  - `scatter_plot`
  - `histogram`
  - `pie_chart`
  - `donut_chart`
  - `heatmap`
  - `data_table`
  - `kpi_cards`
  - `no_reliable_visualization`
- Copied version-local fixtures for all listed visualization options.
- Preserved the CLI LLM flow that extracts and prints only `suggested_visualization`.
- Kept Russian browser copy and inherited local file-validation behavior.

## Files And Folders Created

- `specs/04_sheet_visualizations/sheet_visualizations_spec.md`
- `specs/04_sheet_visualizations/implementation_report.md`
- `tests/04_sheet_visualizations/`
- `tests/04_sheet_visualizations/test_cases/`
- `tests/04_sheet_visualizations/browser-visualizations.spec.ts`
- `tests/04_sheet_visualizations/visualization-choice.test.mjs`
- `tests/04_sheet_visualizations/run_04_sheet_visualizations_tests.ps1`
- `versions/04_sheet_visualizations/`
- `versions/04_sheet_visualizations/lib/suggested-visualization.ts`
- `versions/04_sheet_visualizations/lib/graph-plot.ts`
- `versions/04_sheet_visualizations/components/VisualizationPanel.tsx`

## Main Implementation Changes

- `LoaderResultPanel` now builds a `SuggestedVisualization` block and renders a graph panel.
- `select-visualization.ts` now distinguishes repeated-category bars, pie vs donut, heatmap-shaped data, KPI metric/value sheets, tables, and no-chart cases.
- `profile-table.ts` retains full parsed row objects in `rows` plus a capped `previewRows` sample.
- `graph-plot.ts` validates referenced columns, aggregates values from full rows, bins histograms, builds heatmap cells, and falls back cleanly.
- `VisualizationPanel.tsx` renders simple SVG charts, CSS pie/donut charts, heatmaps, KPI cards, tables, and no-chart messages.

## Commands Run

```powershell
npm run typecheck
npm run build
node --test tests/04_sheet_visualizations/visualization-choice.test.mjs
.\tests\04_sheet_visualizations\run_04_sheet_visualizations_tests.ps1 -BaseUrl http://localhost:3001 -PagePath /
npm run build
.\tests\04_sheet_visualizations\run_04_sheet_visualizations_tests.ps1 -BaseUrl http://localhost:3003 -PagePath /
```

## Test Results

- Typecheck: passed.
- Production build: passed.
- CLI regression tests: 2 passed, 0 failed.
- Browser visualization tests: 12 passed, 0 failed.
- Total automated tests in final runner: 14 passed, 0 failed.

## Issues And Fixes

- First browser run: `heatmap.tsv` rendered as `scatter_plot`.
- Cause: generic two-number scatter logic ran before the heatmap-specific categorical plus numeric-bucket plus value signature.
- Fix: moved heatmap-shaped detection before scatter and selected `[category, bucket, value]` columns explicitly.
- Result: rerun passed the browser visualization tests.
- Follow-up correction: initial graph rendering used `previewRows`, which only covered the first 200 parsed rows.
- Fix: added full client-side `rows` to sheet profiles and changed graph/table/KPI builders to use `rows`.
- Regression: added `bar_chart_full_file_semicolon.csv`, where the important category appears after the preview cutoff.
- Runtime follow-up: a stale webpack dev server produced `Cannot read properties of undefined (reading 'call')` from Next's dev client manifest path.
- Fix: changed `npm run dev` to use `next dev --turbo`; verified the full runner against Turbopack on port `3003`.

## Known Limitations

- The browser renderer consumes the `suggested_visualization` shape, but the current browser page derives that block locally from the selected type. A live browser LLM endpoint can be wired later without changing the renderer contract.
- Charts are intentionally simple MVP SVG/CSS visuals, optimized for readability and deterministic tests.
- Only the best detected sheet dataset is rendered.

## Next Steps

- Add a real browser `/api/analyze` flow that calls the LLM and returns `suggested_visualization`.
- Add richer chart interactivity and export options after the core flow is stable.
