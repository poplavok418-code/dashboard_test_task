# Dashboard Test Task

MVP web service for uploading tabular or text data, preprocessing it in the browser/server app, generating dashboard-style visualizations, and asking questions about the uploaded data.

The latest completed version is in `versions/08_task_corrections`.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- lucide-react for UI icons
- react-dropzone for file upload
- Papa Parse for CSV/TSV parsing
- SheetJS (`xlsx`) for Excel/ODS workbooks
- Playwright for browser checks
- Node.js API routes for LLM-backed analysis and chat

## Features

- Upload CSV, TSV, XLS/XLSX/ODS, DOC/DOCX, Markdown, or TXT files.
- Validate file type and size before processing.
- Profile structured sheets and text reports.
- Suggest and render dashboard widgets for suitable tabular data.
- Produce a short Russian narrative insight.
- Ask grounded questions about the uploaded data.
- Fall back gracefully when the LLM is unavailable.

## Requirements

- Node.js 20+ recommended
- npm
- Optional LLM-compatible chat completions API key

## Environment

Create a local `.env` file in the repository root. This file is ignored by Git and must not be committed.

```dotenv
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://llm.c2devel.ru/v1
LLM_MODEL=k2tex/qwen3.6-35b
LLM_MAX_TOKENS=1200
LLM_TEMPERATURE=0.2
LLM_TIMEOUT_MS=15000
```

`NEURALDEEP_API_KEY`, `NEURALDEEP_BASE_URL`, and `NEURALDEEP_CHAT_COMPLETIONS_URL` are also supported for compatibility with earlier versions.

## Run Locally

Use `http://localhost:3000` as the canonical local URL.

```powershell
cd versions\08_task_corrections
npm install
npm run dev -- -p 3000
```

Open:

```text
http://localhost:3000
```

For a production-style local run:

```powershell
cd versions\08_task_corrections
npm install
npm run build
npm run start -- -p 3000
```

## Checks

From the latest version folder:

```powershell
cd versions\08_task_corrections
npm run typecheck
npm run build
```

From the repository root, run the version 08 automated checks:

```powershell
.\tests\08_task_corrections\run_08_task_corrections_tests.ps1 -SkipBrowser
```

With the app already running on `http://localhost:3000`, run browser checks:

```powershell
.\tests\08_task_corrections\run_08_task_corrections_tests.ps1 -BaseUrl http://localhost:3000
```

## Repository Layout

```text
data/       Example source data
prompts/    LLM system prompts
specs/      Feature specs and implementation reports
tests/      Automated tests by version
versions/   Incremental app implementations
```

## Notes

- Do not commit `.env` or API keys.
- `node_modules`, `.next`, logs, Playwright reports, test results, and TypeScript build info are ignored.
- Historical versions are kept for traceability; use `versions/08_task_corrections` for review and local launch.
