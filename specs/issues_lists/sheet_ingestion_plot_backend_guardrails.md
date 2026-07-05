# Sheet Ingestion, Plot, and Backend Guardrails

Status: draft  
Scope: sheet ingestion issues, plot/graph guardrails, and backend stability guardrails.  
Out of scope for now: AI/LLM preprocessing, prompt construction, RAG, narrative generation, and chat context compression.

## 1. Core Principle

The system should accept large and messy sheet files, but it should not try to render, plot, or synchronously analyze everything at once.

Use separate budgets for:

- Upload acceptance: how large a file the system is willing to receive.
- Parsing budget: how much data a backend worker may inspect in one job.
- Preview budget: how much data the UI displays.
- Plot budget: how many rows, categories, series, and points a chart may render.
- Storage budget: how long raw files and processed artifacts are retained.

For a 1 GB file target, browser-only parsing is not robust enough. Large files should go through a backend upload and async processing pipeline.

## 2. Recommended Initial Limits

These are conservative operational limits for a 1 GB-capable MVP.

```ts
const INGESTION_LIMITS = {
  maxUploadFileSizeBytes: 1_073_741_824, // 1 GiB
  maxOriginalFilesPerUpload: 1,
  maxWorkbookSheetsInspected: 50,
  maxWorkbookSheetsReturnedToUi: 20,
  maxTablesDetectedPerSheet: 10,

  // Backend workers may inspect more data than the UI displays.
  maxRowsInspectedPerTable: 1_000_000,
  maxColumnsInspectedPerTable: 1_000,
  maxCellsInspectedPerTable: 20_000_000,

  // UI and charting budgets stay small.
  maxPreviewRows: 200,
  maxPreviewColumns: 100,
  maxPlotInputRows: 100_000,
  maxRenderedPointsPerChart: 2_000,
  maxChartsPerDashboard: 4,

  maxTextCellCharsForPreview: 1_000,
  maxCellCharsForStats: 10_000,
  maxHeaderScanRows: 50,
  maxConsecutiveBadRowsBeforeAbort: 10_000,

  parseTimeoutMs: 180_000,
  chartBuildTimeoutMs: 15_000,
  jobHardTimeoutMs: 600_000,
};
```

Important: `maxUploadFileSizeBytes` is not the amount of data that should be rendered, plotted, or sent to any later analysis stage. A 1 GB file must be reduced into previews, schema, statistics, warnings, and aggregated chart datasets.

## 3. Recommended Backend Shape

For 1 GB files, use this flow:

```txt
Client
  -> request upload URL
  -> upload file directly to object storage
  -> create ingestion job
  -> backend worker parses file
  -> worker writes normalized metadata, previews, stats, chart-ready aggregates
  -> client polls job status or subscribes to updates
```

Avoid this flow for large files:

```txt
Client -> API route receives whole file in memory -> parse synchronously -> return dashboard
```

That approach will fail under large files, slow networks, serverless memory limits, and user retries.

## 4. Main Sheet Issues and Proposed Solutions

| Issue | Why it breaks the product | Proposed solution |
|---|---|---|
| File is very large, up to 1 GB | Browser or API route can freeze or run out of memory | Use direct-to-storage upload, async backend jobs, streaming parsers where possible, progress states, timeouts, and cancellation |
| File extension lies | A `.csv` may contain binary Excel data or vice versa | Detect type by file signature/MIME and parser probing, not extension alone |
| Unsupported format | Users may upload uncommon exports | Return a friendly unsupported-format state with accepted formats and no crash |
| Corrupt file | Parser may throw low-level errors | Catch parser errors, classify as corrupt/unreadable, preserve error details in logs only |
| Password-protected workbook | Data cannot be read | Detect and show "password-protected files are not supported yet" |
| Macro-enabled workbook | May contain macros or executable-ish content | Never execute macros, read values only, treat macros as ignored metadata |
| Zip bomb or decompression bomb | XLSX/ODS are compressed containers and can expand massively | Enforce compressed size, uncompressed size, entry count, compression ratio, and extraction time limits |
| Too many sheets | Sheet selection becomes noisy and parsing gets expensive | Inspect only first N sheets or top N visible sheets, score sheets, expose selector |
| Hidden sheets | Hidden data may surprise the user | Ignore hidden sheets by default or clearly label them if included |
| Empty sheets | Waste parsing and UI space | Drop sheets with no meaningful non-empty cells |
| Mostly empty sheets | May look like data but contain sparse notes | Compute data density, deprioritize low-density sheets |
| Multiple tables in one sheet | One sheet may contain separate blocks | Detect separated table regions; select largest/best table by default; let user switch |
| Title rows before data | Header is not on row 1 | Scan top rows and choose likely header row based on density and data-like rows below |
| Footer rows | Totals, notes, and export metadata pollute stats | Detect repeated footer patterns, "Total" rows, and sparse note rows; mark or exclude from chart candidates |
| No header row | Columns become ambiguous | Generate `Column 1`, `Column 2`; let user rename later |
| Duplicate headers | Object keys overwrite each other | Make internal names unique, such as `Revenue`, `Revenue 2`; keep original labels |
| Blank headers | Columns cannot be referenced clearly | Generate stable names and warn that headers were missing |
| Multi-row headers | Headers may span multiple rows | Flatten obvious multi-row headers, for example `Q1 Revenue`; otherwise pick best row |
| Merged cells | Values appear visually repeated but parse as blanks | Do not rely on visual layout; optionally forward-fill header-area merged values |
| Ragged rows | CSV rows may have different column counts | Normalize to max detected columns, mark malformed rows, keep parse warnings |
| Extra delimiters in text | CSV parsing creates shifted columns | Use robust CSV parser with quote handling and delimiter detection |
| Unknown delimiter | Semicolon, tab, pipe, comma vary by locale/tool | Auto-detect among comma, semicolon, tab, and pipe; retry if only one column is detected |
| Broken quoting | CSV may contain unclosed quotes | Use tolerant parsing with bad-row counters; continue when safe |
| Encoding mismatch | Cyrillic or special characters become corrupted | Detect BOM, try UTF-8 first, flag replacement-character-heavy text, allow later encoding fallback |
| Very long cell text | UI and stats become heavy | Truncate for preview and stats; retain raw file separately |
| Line breaks inside cells | CSV/table display can look like extra rows | Use proper parser, preserve value, normalize preview display |
| Formula cells | Parsed value may be formula text or stale cached value | Prefer cached/displayed value; never execute formulas; mark formulas in metadata if detectable |
| Error cells | Values like `#DIV/0!` or `#N/A` pollute stats | Treat spreadsheet error tokens as missing or error values |
| Numeric strings | Numbers arrive as text | Use conservative numeric inference by column confidence |
| Locale numbers | `1,234.56`, `1 234,56`, and `1.234,56` differ | Infer decimal and thousands separators per column |
| Currency values | `$1,200`, `EUR 5.4k`, etc. parse as text | Strip common currency symbols/codes for numeric stats while retaining raw values |
| Percent values | `45%` should be 0.45 or 45 depending context | Parse consistently and store semantic type as percent |
| Accounting negatives | `(500)` means `-500` | Support accounting negative format during numeric parsing |
| Date ambiguity | `07/04/2026` can mean July 4 or April 7 | Infer dates only with high confidence; preserve raw values; avoid date charts when ambiguous |
| Excel serial dates | Excel stores dates as numbers | Detect date-formatted cells when parser exposes metadata; handle 1900/1904 systems |
| Mixed data types in one column | Schema inference becomes unstable | Assign type by confidence; fall back to text/mixed and exclude from numeric charts |
| Boolean variants | `yes/no`, `true/false`, `1/0` vary | Normalize common boolean patterns when confidence is high |
| Missing value variants | `N/A`, `null`, `-`, empty, `None` vary | Normalize common placeholders to missing values |
| ID-like columns | User IDs and invoice IDs look numeric but should not be summed | Detect ID patterns by uniqueness, name, and integer-like distribution; exclude from measures |
| High-cardinality categories | Pie/bar charts become unreadable | Use top N plus Other, or exclude from category charts |
| Mostly unique text columns | Comments/descriptions are not useful as axes | Treat as text dimensions only for search/preview, not plots |
| Mostly empty columns | Charts and summaries become noisy | Exclude columns above a missingness threshold from chart candidates |
| Outlier-heavy numeric columns | Axes become unreadable | Detect outliers; use winsorized chart domains or show outlier warnings |
| Duplicate rows | Counts and totals may be inflated | Detect duplicate row ratio; surface warning, but do not auto-drop unless user opts in |
| Subtotal/total rows | Aggregations double count data | Detect rows labeled Total/Subtotal and exclude from derived aggregates by default |
| Filtered Excel rows | User may expect only visible rows | Decide policy: read all rows by default, or respect hidden/filtered rows when parser supports it |
| Pivot-table sheets | Data is already aggregated | Treat as summary table; avoid re-aggregating totals blindly |
| Charts/images/comments in workbook | Not useful for raw analysis | Ignore non-cell visual artifacts for MVP |
| Very wide sheets | Hundreds or thousands of columns break UI | Cap columns inspected/rendered; prioritize non-empty and typed columns |
| Very tall sheets | Millions of rows cannot be previewed | Stream/sample for stats, show preview slice, build aggregate datasets |
| Binary or control characters | Can break display or logs | Sanitize display strings and logs |
| Potential CSV injection | Values beginning with `=`, `+`, `-`, `@` can be dangerous if exported | Escape dangerous leading characters on any re-export |
| PII columns | Emails, phones, names may appear | Detect and label likely PII; avoid using PII columns as chart labels by default |

## 5. Plot and Graph Guardrails

Charts should be built from validated, reduced datasets, not raw sheets.

### 5.1 Global Chart Limits

```ts
const PLOT_LIMITS = {
  maxChartsPerDashboard: 4,
  maxRenderedPointsPerChart: 2_000,
  maxSeriesPerChart: 12,
  maxCategoriesForBar: 30,
  maxCategoriesForPie: 8,
  maxSlicesForDonut: 8,
  maxLinePointsPerSeries: 500,
  maxScatterPoints: 5_000,
  maxHeatmapCells: 2_500,
  minRowsForChart: 2,
  maxAxisLabelChars: 40,
  maxLegendLabelChars: 32,
};
```

### 5.2 Chart Type Guardrails

| Chart type | Main risks | Guardrails |
|---|---|---|
| Bar chart | Too many categories, unreadable labels, ID columns used as categories | Use top 20-30 categories plus Other; reject ID-like columns; truncate labels |
| Line chart | Irregular dates, too many points, non-time x-axis | Require date/time or ordered numeric x-axis; bucket by day/week/month; cap points |
| Area chart | Misleading with sparse or negative values | Use only for time series with comparable positive measures |
| Pie/donut chart | Too many slices, negative values, values do not form a meaningful whole | Allow only positive values with <= 8 categories; prefer bar chart otherwise |
| Scatter plot | Too many points, overplotting, non-numeric axes | Require two numeric columns; sample or bin when over point limit |
| Histogram | Bad bin count, non-numeric data | Require numeric column; auto-bin with capped bin count |
| Heatmap | Too many cells, sparse matrix | Cap cells; use only when two low-cardinality dimensions and one measure exist |
| Stacked bar | Too many stacks, confusing totals | Cap series; require compatible measures; use normalized mode only when meaningful |
| KPI cards | Wrong aggregation of IDs or categorical strings | Use only validated measures/counts/rates; never sum ID-like columns |

### 5.3 Column Eligibility Rules

Numeric measure candidates:

- At least 70 percent parseable numeric values.
- Not ID-like.
- Not mostly missing.
- Not a spreadsheet error column.
- Not high-cardinality integer identifiers.

Categorical dimension candidates:

- Unique value count between 2 and 50 for general charting.
- Unique value count <= 30 for bar chart.
- Unique value count <= 8 for pie/donut.
- Average label length below display threshold, or labels can be cleanly truncated.

Date/time dimension candidates:

- At least 70 percent parseable date values.
- Ambiguity score below threshold.
- Enough distinct dates to show a trend.

Text columns:

- Usable for preview/search.
- Not usable as primary chart dimensions unless low-cardinality.
- Long free-text columns should be excluded from automatic charts.

### 5.4 Plot Data Reduction

Use deterministic reduction before rendering:

- Top N categories plus Other.
- Date bucketing by day, week, month, quarter, or year.
- Numeric binning for histograms.
- Sampling or density/binning for scatter plots.
- Aggregation functions: count, sum, average, median, min, max.
- Outlier-aware domains for axes.

Never let a chart component receive a million raw rows directly.

### 5.5 Plot Failure Fallbacks

If chart generation cannot find good candidates:

- Show a compact data preview.
- Show KPI cards such as row count, column count, missingness, duplicate ratio.
- Show "No reliable chart candidates found" with a calm explanation.
- Avoid rendering empty chart frames.

## 6. Backend Guardrails

| Area | Risk | Proposed guardrail |
|---|---|---|
| Upload | Large files exceed API memory limits | Direct upload to object storage with signed URLs |
| Processing | Long parsing blocks request lifecycle | Background jobs with queue and worker pool |
| Memory | Parser loads entire workbook into memory | Prefer streaming parsers for CSV; for XLSX/ODS use worker memory limits and fail gracefully |
| Timeouts | Jobs hang on weird files | Soft timeout for parsing phase and hard timeout for whole job |
| Retries | Retrying huge jobs wastes resources | Retry only transient failures; do not retry deterministic parse errors |
| Progress | User sees frozen UI | Report upload progress, queued, parsing, profiling, chart-building, done/failed |
| Cancellation | User uploads wrong file | Allow cancellation and cleanup of queued/running jobs when possible |
| Storage | Raw files accumulate | Retention policy for raw uploads and derived artifacts |
| Observability | Failures are hard to debug | Store structured warnings, parser version, file signature, timing, row/column counts |
| Security | Malicious files or formulas | Never execute formulas/macros, sanitize strings, scan files if production requires it |
| Multi-tenant load | One user can consume all workers | Per-user/job concurrency limits and queue quotas |
| Serverless limits | 1 GB processing may exceed platform limits | Use dedicated worker runtime or managed job service, not only serverless API routes |
| Partial success | Some sheets parse, others fail | Return successfully parsed sheets with warnings for failed sheets |

## 7. User-Facing Warning Examples

The product should clearly explain reductions and decisions:

- "This file is 842 MB, so analysis is running in the background."
- "Only the first 1,000,000 rows were inspected for this table."
- "The workbook has 73 sheets. The first 50 were inspected."
- "12 empty sheets were ignored."
- "The sheet `Export` was selected automatically because it contains the densest table."
- "Column `user_id` was excluded from charts because it looks like an identifier."
- "Chart labels were grouped into Top 20 plus Other."
- "Several dates were ambiguous, so automatic time-series charts were skipped."
- "The file appears to be password-protected and cannot be read."

## 8. MVP Recommendation

For a robust 1 GB-ready MVP:

1. Accept uploads up to 1 GiB, but process them asynchronously.
2. Store raw files outside the app server, preferably object storage.
3. Parse CSV/TSV with streaming support.
4. Parse XLSX/XLS/ODS in isolated workers with memory and time limits.
5. Normalize every sheet into table candidates.
6. Score sheets and tables, then auto-select the best one.
7. Build chart-ready aggregates with strict plot budgets.
8. Render only reduced datasets.
9. Return warnings whenever rows, columns, sheets, categories, or points are capped.
10. Keep AI/LLM-specific preprocessing separate and out of this layer for now.

The main design goal is simple: the backend may swallow a large, messy file, but the UI and chart layer should only ever receive small, clean, typed, bounded datasets.
