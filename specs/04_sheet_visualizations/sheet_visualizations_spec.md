# 04 Sheet Visualizations Spec

Status: draft
Version: `04_sheet_visualizations`

## Goal

Render the visualization selected by the LLM agent for uploaded sheet data. The release inherits `03_visualization_choice`, keeps the `suggested_visualization` response block as the chart contract, and adds a browser-visible plot or table after the user uploads a supported sheet file.

## Scope

- Accept the same sheet and text inputs inherited from `03_visualization_choice`.
- Keep the `03` command-line LLM flow that extracts only `suggested_visualization`.
- Add browser chart rendering from the `suggested_visualization` block shape:
  - `type`
  - `encoding`
  - `data_requirements`
  - `display`
  - `fallback`
  - `caveats`
- Use local preprocessed full sheet rows to build chart-ready data without sending raw file bytes to a backend.
- Support visible renderers for:
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
- Add version-local fixtures for all listed options by copying the `03` test case files.

## Out Of Scope

- Real-time browser calls to the production LLM endpoint.
- Persisting uploads or generated chart specs.
- Rendering multiple charts from one upload.
- Advanced chart interactivity beyond readable labels, values, and hover titles.
- Replacing the CLI LLM client or prompt.

## Baseline Behavior

Inherited from `03_visualization_choice`:

- Russian data-loader page.
- Local file validation and preprocessing for supported sheet/text files.
- Stable loader selectors: `data-loader-page`, `file-dropzone`, `file-input`, `paste-text-input`, `loader-result`, `loader-error`, and `visualization-type`.
- CLI flow that reads a sheet, builds compact context, calls the LLM-compatible API, extracts `suggested_visualization`, and prints only that block.
- Regression coverage for accepted CSV upload and unsupported file rejection.

## New Behavior

- Accepted sheet files show a graph/table panel below the visualization decision.
- The graph panel uses `data-testid="graphplot-panel"` and the rendered type uses `data-testid="graphplot-<type>"`.
- The renderer validates that referenced columns exist in the selected dataset.
- If the selected block cannot produce a reliable plot, the UI shows a Russian fallback explanation and, where possible, a bounded data table.
- Text inputs keep the inherited local preprocessing behavior and use a table/no-chart explanation rather than forcing numeric charts.

## UI Text Requirements

- All browser-facing copy is Russian.
- The chart panel title uses `suggested_visualization.title` when available.
- Chart caveats are displayed as short Russian notes.
- No raw stack traces or implementation errors are shown to users.

## Data Contract

Browser renderer input:

```ts
type SuggestedVisualization = {
  type: "bar_chart" | "line_chart" | "scatter_plot" | "histogram" | "pie_chart" |
    "donut_chart" | "heatmap" | "data_table" | "kpi_cards" | "no_reliable_visualization";
  title: string;
  description: string;
  encoding: {
    x: string | null;
    y: string | null;
    category: string | null;
    series: string | null;
    value: string | null;
    aggregation: "count" | "sum" | "avg" | "median" | "min" | "max" | null;
  };
  data_requirements: {
    required_columns: string[];
    excluded_columns: string[];
    filters: unknown[];
    sort: { by: string | null; direction: "asc" | "desc" | null };
    limit: number | null;
    group_small_categories_as_other: boolean;
  };
  display: {
    x_axis_label: string | null;
    y_axis_label: string | null;
    legend_title: string | null;
    value_format: "number" | "percent" | "currency" | "integer" | null;
  };
  fallback: { type: "data_table" | "no_reliable_visualization"; reason: string };
  caveats: string[];
  chart_candidate_id: string | null;
};
```

## Validation Rules

- Only columns present in the selected sheet dataset can be used.
- Missing numeric values are skipped for numeric charts.
- Pie and donut charts skip non-positive values.
- Category charts are limited to the requested `limit` or a safe default.
- Large categories may be grouped as `Другие` when requested.
- `data_table` shows a bounded preview.
- `no_reliable_visualization` shows a clear no-chart state.
- Raw uploaded bytes must remain client-side.

## Component Plan

- `lib/suggested-visualization.ts`: normalize the local visualization decision into the same block shape returned by the LLM.
- `lib/graph-plot.ts`: convert sheet datasets and suggested blocks into chart-ready plot models.
- `components/VisualizationPanel.tsx`: render SVG/table/KPI views from the plot model.
- `components/LoaderResultPanel.tsx`: show the decision and attach the graph panel.

## Acceptance Criteria

- Uploading each version-local fixture renders the corresponding graph/table panel.
- The UI exposes stable selectors for the graph panel and graph type.
- Uploaded CSV/XLSX/TSV files are parsed locally and charted from all parsed rows; samples/previews are only for LLM context and lightweight UI previews.
- Unsupported files still show the inherited Russian error.
- The version-local runner executes CLI regression tests and browser visualization tests.
- Typecheck and build pass for `versions/04_sheet_visualizations`.

## Automated Test Matrix

- CLI regression: mocked LLM still returns only `suggested_visualization` for every supported type.
- Browser happy paths:
  - `bar_chart_semicolon.csv` renders `graphplot-bar_chart`.
  - `line_chart.xlsx` renders `graphplot-line_chart`.
  - `scatter_plot.csv` renders `graphplot-scatter_plot`.
  - `histogram.csv` renders `graphplot-histogram`.
  - `pie_chart.csv` renders `graphplot-pie_chart`.
  - `donut_chart.csv` renders `graphplot-donut_chart`.
  - `heatmap.tsv` renders `graphplot-heatmap`.
  - `data_table.csv` renders `graphplot-data_table`.
  - `kpi_cards.csv` renders `graphplot-kpi_cards`.
  - `no_reliable_visualization.csv` renders `graphplot-no_reliable_visualization`.
- Browser regression: unsupported files still produce a friendly Russian rejection.

## Manual Test Cases

- Start the app from `versions/04_sheet_visualizations` and upload each fixture under `tests/04_sheet_visualizations/test_cases`.
- Confirm a plot, KPI group, table, or no-chart message appears after upload.
- Confirm visual labels and messages are in Russian.
- Confirm clearing the loader removes the rendered plot.

## Known Limits

- The browser currently uses the same visualization block shape locally derived from the selected type; wiring a live browser LLM endpoint can reuse the same renderer.
- SVG charts are intentionally simple and optimized for deterministic MVP tests.
- Only the first/best preprocessed sheet dataset is rendered.
