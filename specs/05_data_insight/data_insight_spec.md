# 05 Data Insight Spec

Status: draft
Version: `05_data_insight`

## Goal

Add an LLM-generated data insight narrative to the sheet dashboard. The insight agent must receive compact, preprocessed data context, return structured JSON with `reasoning` followed by `insight`, and the browser UI must display the resulting insight text in the chart header area above the rendered graph.

## Scope

- Inherit `04_sheet_visualizations` upload, preprocessing, visualization selection, and graph rendering behavior.
- Add `prompts/insight_agent_prompt.md`.
- Add a version-local CLI flow that can call the same NeuralDeep-compatible LLM API using the existing `NEURALDEEP_API_KEY` environment variable.
- Add a compact insight context for sheet data that includes:
  - dataset shape,
  - column profiles,
  - deterministic numeric/category/date summaries,
  - top locally generated insight candidates,
  - data quality warnings,
  - bounded sample rows only.
- Parse the LLM output from this required shape:

```json
{
  "reasoning": "",
  "insight": ""
}
```

- Display the `insight` text above the graph itself, replacing the `04` chart-description text location with a data-insight narrative.
- Keep the existing chart type badge and rendered chart/table/KPI behavior.

## Out Of Scope

- Full Ask-the-Data chat.
- Multi-chart generation.
- Sending raw uploaded file bytes or full large row arrays to the backend/LLM.
- Persisting insights.
- Real browser network calls to the production LLM endpoint. Browser tests use deterministic local insight generation so the UI remains testable offline.

## Baseline Behavior

Inherited from `04_sheet_visualizations`:

- Russian data-loader page.
- Local file validation and preprocessing for supported sheet/text files.
- Stable loader selectors including `data-loader-page`, `file-dropzone`, `file-input`, `paste-text-input`, and `loader-error`.
- Graph panel selectors:
  - `graphplot-panel`
  - `graphplot-<type>`
  - `visualization-type`
- Browser rendering for all supported visualization types.
- CLI LLM flow style that loads `.env`, uses `NEURALDEEP_API_KEY`, posts to a chat-completions-compatible endpoint, and validates a structured response.

## New Behavior

- Accepted sheet files show an insight narrative in the graph panel header.
- The visible insight text uses `data-testid="data-insight"`.
- The insight text is generated from an `InsightAgentResponse` shape with `reasoning` and `insight`.
- In the browser, the insight is derived locally from the same compact insight context so the MVP works without exposing API keys client-side.
- In CLI tests, the mocked LLM must receive `prompts/insight_agent_prompt.md`, compact context, and must return structured output.
- The CLI prints only the normalized insight block, not the whole chat completion.

## UI Text Requirements

- Browser-facing text is Russian.
- The chart panel eyebrow changes from a graph-only label to an AI/data-insight label.
- The insight should be concise and useful, ideally 5 sentences when the LLM provides them.
- If a reliable insight cannot be produced, the UI shows a modest Russian fallback instead of a blank or raw error.
- No raw stack traces or implementation errors are shown to users.

## Data Contract

Insight agent output:

```ts
type InsightAgentResponse = {
  reasoning: string;
  insight: string;
};
```

Insight context:

```ts
type InsightContext = {
  sourceType: "sheet";
  fileName: string;
  sheetName?: string;
  rowCount: number;
  columnCount: number;
  columns: Array<{
    name: string;
    inferredType: string;
    nonEmptyCount: number;
    missingCount: number;
    uniqueCount?: number;
    examples: string[];
    flags: string[];
    numericStats?: {
      min: number;
      max: number;
      mean: number;
      median: number;
      sum: number;
    };
    categoryStats?: {
      topValues: Array<{ label: string; count: number; share: number }>;
    };
  }>;
  insightCandidates: Array<{
    type: string;
    claim: string;
    evidence: string;
    score: number;
  }>;
  warnings: Array<{ code: string; message: string }>;
  sample: {
    columns: string[];
    rows: string[][];
  };
};
```

## Validation Rules

- `reasoning` and `insight` must both be strings.
- Empty or whitespace-only `insight` is invalid for the CLI parser.
- Browser fallback insight is allowed only when no usable sheet dataset exists.
- LLM context samples are capped and must not include unbounded full-file row arrays.
- Numeric insight candidates must ignore ID-like and mostly-missing columns.
- Categorical concentration insights must ignore high-cardinality and mostly-missing columns.

## Component And Module Plan

- `prompts/insight_agent_prompt.md`: strict insight-agent prompt with required structured JSON.
- `lib/data-insight.ts`: build insight context, generate local fallback insight, and expose shared types.
- `lib/insight-response-parser.mjs`: normalize/validate LLM response JSON.
- `lib/llm-client.mjs`: add `callInsightAgent` while keeping visualization calls intact.
- `index.mjs`: add `--mode insight` support and default insight prompt path for insight mode.
- `components/VisualizationPanel.tsx`: accept an optional `insight` prop and render it at `data-testid="data-insight"` above the graph.
- `components/LoaderResultPanel.tsx`: build local insight text from the best sheet dataset and pass it into the chart panel.

## Acceptance Criteria

- `05_data_insight` is self-contained under `versions/05_data_insight`.
- Uploading a supported sheet fixture renders the graph panel and visible Russian insight text above the chart.
- The insight text appears at `data-testid="data-insight"`.
- The inherited visualization type and chart/table renderers still work.
- The insight CLI uses `prompts/insight_agent_prompt.md`, the same API-key environment contract, and prints only `{ "reasoning": "...", "insight": "..." }`.
- Mocked CLI tests confirm raw full-file row arrays are not sent to the LLM.
- Typecheck and build pass for `versions/05_data_insight`.

## Automated Test Matrix

- Unit/CLI:
  - insight parser accepts the required JSON shape.
  - insight parser rejects empty insight.
  - mocked insight-agent CLI sends compact context and prints only the normalized insight block.
  - missing API key fails clearly.
- Browser:
  - `bar_chart_semicolon.csv` renders a graph and `data-insight`.
  - `line_chart.xlsx` keeps inherited line-chart rendering and shows an insight.
  - unsupported PDF still shows a friendly Russian error and no graph panel.
  - rendered graph data still includes rows beyond the preview cutoff.

## Manual Test Cases

- Start the app from `versions/05_data_insight`.
- Upload `tests/05_data_insight/test_cases/bar_chart_semicolon.csv`.
- Confirm the graph panel contains a concise Russian insight above the chart.
- Confirm the chart type badge and chart marks still render.
- Upload unsupported PDF and confirm the existing friendly rejection state remains.
- Run CLI insight mode against a sheet with a real `NEURALDEEP_API_KEY` and confirm the response has `reasoning` and `insight`.

## Known Limits

- Browser insight generation is deterministic for this release so the UI is usable without exposing the API key client-side.
- The live LLM insight call is available through the version-local CLI and can be moved into a server route in a later version.
- Insight quality depends on compact profiling and candidate generation, not exhaustive statistical modeling.
