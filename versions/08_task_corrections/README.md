# 08_task_corrections

This version inherits `07_color_change` and corrects the remaining MVP gaps against `Initial_task.md`.

## What Changed

- Adds a separate Russian AI narrative hero widget.
- Keeps hero insights to 2-3 sentences.
- Renders a dashboard grid with 2-3 visual widgets for structured sheet data when reliable candidates exist.
- Keeps the ask-the-data chat grounded in compact uploaded-data context.
- Adds explicit missing-information wording: `В этом отчете нет такой информации.`

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- lucide-react
- react-dropzone
- Papa Parse and SheetJS

## Local Setup

```bash
npm install
npm run dev -- -p 3000
```

For this handoff, the implementation was prepared without starting a browser server.

## Environment Variables

The app reads LLM settings from the repository root `.env` or process env:

```dotenv
LLM_API_KEY=<your-key>
LLM_BASE_URL=https://llm.c2devel.ru/v1
LLM_MODEL=k2tex/qwen3.6-35b
LLM_MAX_TOKENS=1200
LLM_TEMPERATURE=0.2
```

If the LLM is unavailable, the UI shows local deterministic fallbacks instead of a blank page.

## Checks

From `versions/08_task_corrections`:

```bash
npm run typecheck
npm run build
```

From the repository root:

```powershell
.\tests\08_task_corrections\run_08_task_corrections_tests.ps1 -SkipBrowser
```

When a local server is already healthy on `http://localhost:3000`, run browser tests:

```powershell
.\tests\08_task_corrections\run_08_task_corrections_tests.ps1 -BaseUrl http://localhost:3000
```

## Known Limits

- Chat uses compact profile/sample/text chunks, not full vector RAG.
- Text-only reports may show a hero and chat without forcing numeric charts.
- The app keeps custom SVG chart rendering from the previous versions.
