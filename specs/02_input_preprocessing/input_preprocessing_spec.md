# 02 Input Preprocessing

Status: implementation contract

## Goal

Build the second version of the app as a self-contained release based on `01_basic_page`. The page must keep the Russian browser-first loader experience and add local preprocessing after an input is accepted.

The page should answer:

- What did the user provide?
- Was it accepted or rejected by the existing loader checks?
- For sheet-like inputs, what datasets/tables were detected and what basic schema do they have?
- For text-like inputs, what normalized text statistics and chunks are available?
- What warnings should the user see before later LLM/chart steps?

## Out Of Scope

- LLM calls, AI summaries, chat, and chart rendering.
- Backend upload or persistent storage.
- Production-scale 1 GB processing.
- Legacy `.doc` extraction.
- Full semantic document analysis.

## User-Facing Behavior

All visible copy must be in Russian except internal code values such as `sheets`, `text`, or `accepted`.

The v01 loader remains the first screen:

- one combined file/text input panel;
- drag-and-drop and file picker;
- pasted text input;
- friendly accepted/rejected result panels;
- no raw stack traces.

After an input is accepted, the page shows a preprocessing summary:

- `data-testid="preprocessing-summary"` on the summary panel;
- `data-testid="sheet-profile-list"` for sheet profiles;
- `data-testid="text-chunk-list"` for text chunks;
- `data-testid="data-warning-list"` for warnings.

Sheet files show dataset count, row/column counts, inferred column types, and warnings. Workbook files treat every visible sheet as a separate dataset. Empty sheets are skipped with a warning.

Text inputs show character, word, line, paragraph, and chunk counts. Text longer than `10_000` characters is split into chunks and accepted unless it exceeds the hard `100_000` character limit.

## Data Contracts

```ts
type PreprocessingResult =
  | SheetPreprocessingResult
  | TextPreprocessingResult;

type SheetPreprocessingResult = {
  kind: "sheets";
  datasets: SheetDatasetProfile[];
  warnings: DataWarning[];
};

type SheetDatasetProfile = {
  id: string;
  sourceName: string;
  sheetName?: string;
  rowCount: number;
  columnCount: number;
  previewRows: Record<string, unknown>[];
  columns: ColumnProfile[];
  warnings: DataWarning[];
};

type TextPreprocessingResult = {
  kind: "text";
  stats: {
    charCount: number;
    wordCountApprox: number;
    lineCount: number;
    paragraphCount: number;
  };
  chunks: TextChunk[];
  warnings: DataWarning[];
};

type TextChunk = {
  id: string;
  index: number;
  startChar: number;
  endChar: number;
  text: string;
  charCount: number;
};

type DataWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

type ColumnProfile = {
  name: string;
  inferredType: "number" | "date" | "category" | "text" | "boolean" | "mixed";
  nonEmptyCount: number;
  missingCount: number;
  uniqueCount?: number;
  examples: string[];
  flags: Array<"id_like" | "high_cardinality" | "mostly_missing" | "pii_like">;
};
```

The accepted loader result may include:

```ts
preprocessing?: PreprocessingResult;
```

## Validation And Preprocessing Rules

### Shared Loader Rules

- Preserve v01 checks for single input, supported extension, non-empty input, size limits, and sample readability.
- Do not upload raw file bytes to backend endpoints.
- Keep `.doc` accepted for compatibility but show a warning that legacy Word preprocessing is not supported in this version.

### Sheet-Like Inputs

- Supported sheet inputs: `.csv`, `.tsv`, `.xls`, `.xlsx`, `.ods`.
- CSV delimiter detection checks comma, semicolon, tab, and pipe.
- TSV prefers tab.
- Headers are trimmed.
- Empty headers become stable generated names such as `Column 1`.
- Duplicate headers become unique names such as `Revenue 2`.
- Fully empty rows and columns are removed.
- Each visible workbook sheet becomes one `SheetDatasetProfile`.
- Empty workbook sheets are skipped with a warning.
- Return up to `200` preview rows per dataset.
- Infer column types: `number`, `date`, `category`, `text`, `boolean`, or `mixed`.
- Detect flags: `id_like`, `high_cardinality`, `mostly_missing`, and `pii_like`.
- Parser warnings become user-facing preprocessing warnings.

### Text-Like Inputs

- Supported text preprocessing: pasted text, `.txt`, `.md`, `.log`.
- `.docx` may show an extraction warning if browser extraction is not available.
- Normalize line endings to `\n`.
- Remove control characters except normal whitespace.
- Trim leading/trailing whitespace.
- Compute character, approximate word, line, and paragraph counts.
- If normalized text is `<= 10_000` characters, return one chunk.
- If normalized text is `> 10_000` characters, split into chunks.

```ts
const TEXT_CHUNKING_LIMITS = {
  maxCharsPerChunk: 10_000,
  overlapChars: 500,
  preferredSplitOrder: ["paragraph", "line", "sentence", "hard_char_limit"],
};
```

Chunking must prefer paragraph boundaries, then line boundaries, then sentence boundaries, and finally hard character splits. Neighboring chunks should include up to `500` characters of overlap. Add a warning in Russian when long text is chunked.

## Module Plan

Create v02 implementation in `versions/02_input_preprocessing` by copying v01 without `node_modules`, `.next`, or build artifacts.

Add modules:

- `lib/input-preprocessing-types.ts`
- `lib/chunk-text.ts`
- `lib/preprocess-text.ts`
- `lib/preprocess-delimited-table.ts`
- `lib/preprocess-workbook.ts`
- `lib/profile-table.ts`

Add UI:

- `components/PreprocessingSummary.tsx`

Update:

- `lib/accepted-inputs.ts` for the extended result type and limits.
- `lib/validate-file-input.ts` to run preprocessing after base file validation.
- `lib/validate-text-input.ts` to preprocess pasted text.
- `components/LoaderResultPanel.tsx` to show the preprocessing summary.
- `package.json` with `papaparse` and `xlsx`.

## Acceptance Criteria

- Existing v01 loader behavior still works.
- Supported files and pasted text still show accepted/rejected states correctly.
- CSV, semicolon CSV, and TSV are parsed locally and profiled.
- Duplicate and blank headers are normalized.
- Missing values and high-cardinality/ID-like/PII-like columns produce flags or warnings.
- Workbooks expose each non-empty visible sheet as a separate dataset.
- Empty workbook sheets are skipped with a warning.
- Short text produces one chunk.
- Text over `10_000` characters produces multiple chunks and a warning.
- Chunks do not exceed `10_000` characters.
- Raw file bytes are not posted to backend endpoints.
- `npm run typecheck`, `npm run build`, and v02 Playwright tests pass.

## Automated Tests

Use `tests/02_input_preprocessing/input-preprocessing.spec.ts` and fixtures under `tests/02_input_preprocessing/test_cases`.

Cover:

- Russian page opens with existing loader hooks.
- v01 rejection cases for unsupported, empty, oversized, and multiple inputs.
- comma CSV profile appears.
- semicolon CSV with Cyrillic and decimal comma profile appears.
- TSV profile appears.
- blank/duplicate headers are normalized.
- missing values produce a warning/flag.
- high-cardinality and ID-like columns are flagged.
- workbook returns two non-empty sheet profiles and one skipped-sheet warning.
- short text returns one chunk.
- long text over `10_000` characters is accepted and chunked.
- long single-paragraph text uses hard splitting within chunk limits.
- raw file bytes are not sent to backend endpoints.

## Manual Tests

- Upload realistic business CSV exports with comma, semicolon, and tab delimiters.
- Upload a workbook with multiple sheets and confirm every useful sheet is visible.
- Paste a short Russian report and inspect text stats.
- Paste or upload a long report and confirm chunk count and warning text.
- Try `.doc` and confirm it is accepted with an unsupported-preprocessing warning.
- Try corrupted or mislabeled files and confirm the error is friendly.

## Known Limits

- XLS/XLSX/ODS parsing is still browser memory-bound.
- `.doc` content extraction is not supported.
- `.docx` may be accepted without extraction if browser extraction is not reliable.
- Type inference is heuristic and intentionally conservative.
- Preprocessing prepares compact data for later chart/LLM versions but does not render charts or call an LLM.
