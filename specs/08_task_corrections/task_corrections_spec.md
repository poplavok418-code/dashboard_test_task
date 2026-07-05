# 08 Task Corrections Spec

## Goal

Bring `07_color_change` closer to the original MVP brief in `Initial_task.md` without changing the project architecture or adding deployment/video deliverables.

This version must preserve the working `07_color_change` upload, preprocessing, chart rendering, LLM analysis, and ask-the-data flow, then add the missing product-scope corrections:

- a separate AI narrative hero widget;
- a 2-3 sentence user-facing insight;
- 2-3 dashboard visual widgets for sheet data when enough structure exists;
- clearer "not in this report" chat guardrail wording;
- a current README for the `08_task_corrections` version.

## Out Of Scope

- Publishing to Vercel/Netlify.
- GitHub repository cleanup beyond this version folder.
- Video pitch.
- Authentication, persistence, advanced RAG, vector search, or multi-file upload.
- Starting the app on `localhost:3000` during this implementation handoff.

## Baseline

Baseline implementation: `versions/07_color_change`.

Inherited behavior:

- Russian single-page Next.js App Router UI.
- File drag-and-drop and pasted text input.
- CSV, TSV, XLS, XLSX, ODS, TXT, MD, LOG, DOCX, and graceful DOC fallback handling.
- Local browser preprocessing before LLM calls.
- `/api/analyze` and `/api/chat` route handlers.
- Local deterministic fallbacks when LLM calls fail.
- Existing SVG chart implementations and interactive hover/click readouts.
- Ask-the-data panel and local validation of empty/overlong questions.

## New Or Changed Behavior

### Narrative Hero

After accepted input, the page must show a distinct `NarrativeHero` block above the chart grid.

Russian UI text expectations:

- eyebrow: `AI-нарратив`;
- title: `Главный инсайт`;
- loading state: `Собираем главный инсайт...`;
- fallback badge may indicate local analysis when LLM is unavailable.

The insight shown to the user must be 2-3 sentences. LLM prompts and local fallback text must target this length.

### Dashboard Visual Widgets

For sheet data with enough structure, the dashboard must render 2-3 visual widgets using the existing chart renderer. The first widget is the LLM-selected or deterministic primary chart. Additional widgets are deterministic, validated secondary views selected from safe chart candidates such as bar, line, scatter, histogram, pie/donut, heatmap, KPI cards, or data table.

Rules:

- Prefer 3 widgets when at least 3 reliable candidates can be built.
- Render 2 widgets when only 2 reliable candidates can be built.
- Render 1 cautious fallback widget only when the data is too sparse for multiple reliable visualizations.
- Do not duplicate the same chart type with the same required columns.
- Keep each widget interactive through existing chart controls.

### Chat Guardrail

The talk-to-data prompt and local fallback should clearly tell the user when the supplied compact report context does not contain the requested information. The preferred Russian wording is:

`В этом отчете нет такой информации.`

### README

The version README must describe `08_task_corrections`, local setup, env vars, test commands, and known limitations. It must not claim to be `04 Sheet Visualizations`.

## Data Contracts

The existing `SuggestedVisualization` and `GraphPlot` contracts remain unchanged.

New helper modules may compose multiple `SuggestedVisualization` values from:

- the selected primary visualization;
- profiled sheet columns;
- deterministic safe secondary rules.

The browser must continue sending compact profile/sample context to backend APIs, not raw uploaded file contents.

## Component Plan

- Add `NarrativeHero` for the standalone insight block.
- Add `buildDashboardVisualizations` to produce 1-3 validated visualization suggestions.
- Update `LoaderResultPanel` to render hero, loading skeletons, chart grid, and chat.
- Keep `VisualizationPanel` focused on one `GraphPlot`.
- Update prompts and local insight helpers for 2-3 sentence output.
- Refresh README.

## Acceptance Criteria

- Accepted sheet input shows a distinct hero widget with `data-testid="narrative-hero"`.
- Sheet input with enough structure shows 2-3 graph panels in `data-testid="dashboard-chart-grid"`.
- The primary visualization remains first.
- The hero insight is 2-3 sentences in normal LLM/local output.
- Unsupported file input still shows a friendly Russian error and no dashboard.
- Ask-the-data remains available after accepted input.
- Chat guardrail instructions include `В этом отчете нет такой информации.`
- `npm run typecheck` and `npm run build` pass in `versions/08_task_corrections`.

## Automated Tests

Node/static tests:

- Prompt and local source files target 2-3 sentence insights.
- Chat prompt includes the exact report-missing wording.
- README names `08_task_corrections`.

Browser tests:

- Upload a semicolon CSV and verify hero, chart grid, 2-3 chart panels, and ask panel.
- Upload line-chart XLSX and verify inherited line chart behavior plus multiple widgets.
- Upload unsupported PDF and verify friendly error with no hero/grid/chat.
- Mock failed LLM analysis and verify local fallback still renders hero and dashboard.

## Manual Tests

- Paste a weekly text report and confirm a hero summary appears without forced numeric charts.
- Upload `bar_chart_semicolon.csv` and ask a supported question.
- Ask an unsupported question and confirm the answer is honest about missing evidence.
- Try empty input and unsupported files.

## Known Limits

- Chat still uses compact profile/sample/text chunks, not a full vector index over every raw cell.
- Text-only input may show a narrative and chat without 2-3 numeric charts when the text is not chartable.
- The implementation keeps custom SVG charts rather than migrating to ECharts to avoid broad churn.
