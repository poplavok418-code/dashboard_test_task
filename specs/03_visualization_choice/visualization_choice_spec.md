# 03 Visualization Choice Spec

Status: draft  
Version: `03_visualization_choice`

## Goal

Create a release that includes the `02_input_preprocessing` browser page and a visualization-choice CLI. The CLI accepts sheet files, converts them into compact JSON context, calls a local/smaller LLM through the NeuralDeep OpenAI-compatible chat-completions API, and prints only the `suggested_visualization` block from the LLM response.

## Scope

- Accept sheet-like files: `.csv`, semicolon `.csv`, `.tsv`, `.xlsx`, `.xls`, and `.ods` when the workbook parser is available.
- Parse the sheet into rows without sending the full raw file to the LLM.
- Build a compact dataset profile with column types, examples, statistics, warnings, samples, and deterministic chart candidates.
- Use `prompts/visualization_agent_prompt.md` as the system prompt.
- Call `POST /chat/completions` with model `gpt-oss-120b` by default.
- Extract and print only `suggested_visualization` as JSON.
- Include the browser data-loader page from `02_input_preprocessing` in `versions/03_visualization_choice`.
- Preserve Russian frontend copy, upload/paste behavior, and validation errors from `02_input_preprocessing`.
- For accepted files, replace the old accepted-file details, validation checklist, and preprocessing summary with a compact visualization type decision.
- Provide automated tests with a mocked LLM endpoint for every supported visualization type.
- Add a root `.env` file with placeholders for the API key and LLM settings.

## Out Of Scope

- Rendering selected visualizations in a browser.
- Calling the visualization-choice LLM from the browser page.
- Persisting uploaded files.
- Sending full files or full parsed rows to the LLM.
- Testing the real NeuralDeep endpoint in CI.
- Guaranteeing the real model will choose the same chart as the mocked tests for every ambiguous dataset.

## User-Facing Behavior

The release includes a browser page and a command-line tool.

Browser page:

```txt
cd versions/03_visualization_choice
npm run dev
```

The browser page opens at `/`, accepts one file or pasted text, validates it, preprocesses tables/text locally, and keeps the Russian error states. When a file is accepted, the page shows only the visualization type decision instead of the older accepted-file metadata, checklist, and preprocessing summary.

Command-line example:

```txt
node versions/03_visualization_choice/index.mjs --file tests/03_visualization_choice/test_cases/bar_chart_semicolon.csv
```

On success, stdout contains only one JSON object: the `suggested_visualization` block.

On failure, the command exits with code `1` and prints a concise error to stderr.

## Environment Variables

The tool reads `.env` from the repository root and also respects existing process environment variables.

```txt
NEURALDEEP_API_KEY=
NEURALDEEP_BASE_URL=https://api.neuraldeep.ru/v1
LLM_MODEL=gpt-oss-120b
LLM_MAX_TOKENS=1200
LLM_TEMPERATURE=0.2
```

## Data Contract

The LLM receives compact context:

- `fileName`
- `sheetName`
- `rowCount`
- `columnCount`
- `columns`
- `sample`
- `chartCandidates`
- `warnings`

The LLM response may contain the full prompt-level object, but the CLI prints only:

```json
{
  "type": "line_chart",
  "title": "Revenue over time",
  "description": "Shows the trend in revenue across the available dates.",
  "encoding": {
    "x": "date",
    "y": "revenue",
    "category": null,
    "series": null,
    "value": "revenue",
    "aggregation": "sum"
  },
  "data_requirements": {
    "required_columns": ["date", "revenue"],
    "excluded_columns": [],
    "filters": [],
    "sort": {
      "by": "date",
      "direction": "asc"
    },
    "limit": null,
    "group_small_categories_as_other": false
  },
  "display": {
    "x_axis_label": "date",
    "y_axis_label": "revenue",
    "legend_title": null,
    "value_format": "number"
  },
  "fallback": {
    "type": "data_table",
    "reason": "Use a table if the date column cannot be parsed."
  },
  "caveats": [],
  "chart_candidate_id": "line_date_revenue"
}
```

## Validation Rules

- The input file must exist.
- The extension must be a supported sheet extension.
- CSV/TSV files must contain at least one header row and one data row.
- Workbook files use the first non-empty sheet.
- The LLM response must be valid JSON or contain a parseable JSON object.
- If the response contains the full agent object, `suggested_visualization` is extracted.
- If the response is already a visualization block, it is printed as-is after minimal validation.
- `suggested_visualization.type` must be present.
- Browser preprocessing must stay client-side and must not post raw file bytes to backend endpoints.
- Browser error selectors from `02_input_preprocessing` must remain stable for regression tests.
- Browser accepted state must expose `loader-result` and `visualization-type` selectors.

## Automated Test Matrix

The tests use a local mock LLM server and cover:

- `bar_chart` with semicolon CSV.
- `line_chart` with XLSX.
- `scatter_plot` with comma CSV.
- `histogram` with comma CSV.
- `pie_chart` with comma CSV.
- `donut_chart` with comma CSV.
- `heatmap` with TSV.
- `data_table` with comma CSV.
- `kpi_cards` with comma CSV.
- `no_reliable_visualization` with comma CSV.
- stdout contains only the `suggested_visualization` block.
- the request uses compact dataset context and does not include raw file bytes.
- browser page opens into the Russian data-loader experience.
- browser page accepts a CSV fixture and shows only the visualization type decision.
- browser page still rejects unsupported files with a friendly Russian error.

## Known Limits

- The command-line parser is intentionally small and optimized for MVP fixtures.
- Workbook parsing depends on the `xlsx` package; the version can reuse the installed dependency from `02_input_preprocessing` during tests.
- The real LLM may return invalid JSON; this version reports that cleanly but does not retry.
- The browser page is currently the `02_input_preprocessing` experience copied into `03`; it does not yet render the LLM-selected visualization.
