# 01 Basic Page: Data Loader Spec

Status: draft  
Scope: first deployable slice of the project  
Target hosting: Vercel Hobby/free plan  
Out of scope: LLM analysis, chart generation, chat with data, persistent storage
UI language: Russian

## 1. Goal

Build the first usable page of the product: a browser-first data loader that accepts either one data file or pasted text, validates the input, reads enough metadata to classify it, and displays a clear result.

The page should answer:

- What did the user provide?
- Is it an accepted input type?
- Is it within the allowed size limit?
- Is it sheet-like data or text-like data?
- If rejected, what should the user do next?

This step is intentionally small. It creates the intake layer that later steps will reuse for parsing, profiling, AI summaries, charts, and chat.

## 2. User-Facing Behavior

### Primary Flow: File Upload

1. User opens the page.
2. User drags a file into the loader box or selects a file with the file picker.
3. App validates file extension, MIME hint where available, and file size.
4. App reads a small sample from the file when useful.
5. App shows a result panel:

```txt
File name: sales_export.xlsx
File type: .xlsx
Size: 248 KB
Input kind: sheets
Status: accepted
```

### Primary Flow: Pasted Text

1. User opens the page.
2. User pastes or types text into the loader box.
3. App validates that text is not empty and is within the text size limit.
4. App shows a result panel:

```txt
Input type: pasted text
Size: 1,842 characters
Input kind: text
Status: accepted
```

### Rejection Flow

For invalid input, the page shows a friendly error state with:

- short reason,
- accepted formats or size limit,
- suggested next action.

Example:

```txt
This file type is not supported yet.
Try uploading .csv, .tsv, .xlsx, .xls, .ods, .txt, .md, .log, .docx, or .doc.
```

## 3. UI Requirements

The first screen must be the working product, not a landing page.

All visible user-facing text must be in Russian, including:

- navigation and page labels,
- buttons,
- placeholders,
- validation messages,
- error messages,
- accepted-state messages,
- result labels,
- empty states,
- loading states.

Internal type names and code values may stay in English, for example `sheets`, `text`, `accepted`, and `rejected`.

### Layout

- Top bar with compact product name.
- Main centered working area with a single loader panel.
- One combined loader box inside the panel where the user can either drop/select a file or paste/type text.
- The combined loader should not look like two separate upload/text cards; it should read as one input window with a large text area and file-drop/select affordance in the same surface.
- Result panel below the loader.
- Error/warning panel when needed.

### Loader Panel

The loader box should support:

- drag-and-drop file upload,
- click-to-select file upload,
- paste/type text input,
- visual hover and drag-over states,
- loading/reading state,
- accepted state,
- rejected state.

### Tone

Keep copy concise and product-like. Avoid technical stack traces or raw parser errors in the UI.

Suggested labels:

- "Перетащите файл или вставьте текст"
- "Поддерживаются таблицы и текстовые отчеты"
- "Готово к проверке"
- "Файл принят"
- "Нужен другой файл"

## 4. Accepted Inputs

### Sheet-Like Files

Classify as `sheets`:

- `.csv`
- `.tsv`
- `.xls`
- `.xlsx`
- `.ods`

### Text-Like Files

Classify as `text`:

- `.txt`
- `.md`
- `.log`
- `.docx`
- `.doc`

### Explicitly Unsupported For This Step

- PDFs
- images
- archives such as `.zip` or `.rar`
- multiple files at once
- password-protected or corrupted spreadsheets, beyond a generic unreadable-file error

Note: `.doc` should be accepted and classified as `text`, but this first step only needs to validate and report metadata for it. Extracting text from legacy Word files belongs to a later preprocessing step.

## 5. Size Limits

Because this slice is intended for Vercel Hobby/free hosting, raw files should be read in the browser and should not be uploaded to a Vercel Function.

Recommended first-step limits:

```ts
const BASIC_LOADER_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxTextChars: 100_000,
  maxFileSampleBytes: 64 * 1024,
  maxFilesPerInput: 1,
};
```

Rationale:

- 10 MB keeps browser-side reading responsive during the first implementation.
- 100,000 pasted characters is enough for long reports while staying easy to validate.
- 64 KB sample reading is enough for lightweight type sanity checks without parsing the full file.
- Later project stages can raise limits when parsing and profiling are implemented more carefully.

Future note: the 10 MB file limit is intentionally conservative for the basic loader. Revisit and likely increase this limit in a later ingestion/parsing version after chunking, preview limits, and profiling performance are implemented.

## 6. Vercel Hobby Constraints

Implementation should avoid sending raw files to API routes.

Current Vercel docs note that:

- Hobby projects have free-tier usage limits, including deployment and resource limits.
- Vercel Function request and response payloads are limited to 4.5 MB.
- Vercel Functions on Hobby have bounded memory and duration.

Design consequence for this step:

- The page can be fully client-side.
- Metadata extraction should happen in the browser.
- If an API route is added later, it should receive compact metadata only, not raw file bytes.

Reference docs checked on 2026-07-04:

- `https://vercel.com/docs/limits`
- `https://vercel.com/docs/functions/limitations`

## 7. Data Contract

The loader should produce a small normalized result object that later stages can reuse.

```ts
type InputKind = "sheets" | "text";

type LoaderStatus = "idle" | "reading" | "accepted" | "rejected";

type LoaderResult = {
  status: LoaderStatus;
  source: "file" | "pasted_text";
  inputKind?: InputKind;
  file?: {
    name: string;
    extension: string;
    mimeType: string;
    sizeBytes: number;
    sizeLabel: string;
    lastModified?: number;
  };
  text?: {
    charCount: number;
    wordCountApprox: number;
    lineCount: number;
  };
  checks: ValidationCheck[];
  error?: LoaderError;
};

type ValidationCheck = {
  id:
    | "extension_supported"
    | "mime_hint_checked"
    | "size_within_limit"
    | "not_empty"
    | "single_input_only"
    | "sample_readable";
  ok: boolean;
  label: string;
  detail?: string;
};

type LoaderError = {
  code:
    | "unsupported_type"
    | "file_too_large"
    | "empty_input"
    | "multiple_files"
    | "read_failed";
  message: string;
  suggestion: string;
};
```

## 8. Validation Rules

### File Validation

1. Reject if more than one file is provided.
2. Extract lowercase extension from file name.
3. Reject if extension is not in the accepted list.
4. Reject if `file.size === 0`.
5. Reject if `file.size > BASIC_LOADER_LIMITS.maxFileSizeBytes`.
6. Classify extension as `sheets` or `text`.
7. Read a small sample for text-like files and CSV/TSV files.
8. If browser read fails, show `read_failed`.

### Text Validation

1. Trim pasted text for validation only.
2. Reject if trimmed text is empty.
3. Reject if character count exceeds `maxTextChars`.
4. Classify as `text`.
5. Calculate character count, approximate word count, and line count.

### MIME Handling

Browser MIME values are hints only. Do not reject a file solely because MIME is empty or generic, such as `application/octet-stream`.

Use extension as the primary rule for this first step. Add deeper magic-number or parser probing in later ingestion steps.

## 9. Reading Rules

This step does not need full parsing.

### For CSV/TSV/TXT/MD/LOG

Read up to `maxFileSampleBytes` as text.

Use the sample only to:

- confirm the file is readable,
- detect if it appears empty after trimming,
- later display a small optional preview if wanted.

### For XLS/XLSX/ODS/DOCX/DOC

Do not parse content in this step unless the implementation already has a lightweight library installed.

For the basic loader, it is acceptable to:

- validate extension,
- validate size,
- classify by extension,
- show metadata.

Deeper workbook/document parsing belongs to later steps. Legacy `.doc` text extraction is not required for this page.

## 10. Component Plan

Suggested components:

- `DataLoaderPage`
- `DataInputPanel`
- `FileDropzone`
- `PasteTextBox`
- `LoaderResultPanel`
- `ValidationChecklist`
- `LoaderErrorState`

Suggested utility files:

- `accepted-inputs.ts`
- `format-file-size.ts`
- `validate-file-input.ts`
- `validate-text-input.ts`
- `read-file-sample.ts`

## 11. Implementation Notes

Recommended stack remains aligned with the main technical spec:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui where useful
- lucide-react icons
- react-dropzone for drag-and-drop

No database, auth, backend upload, or LLM key is needed for this slice.

The page should be deployable to Vercel as a normal Next.js app. Since processing is client-side, the first slice should not depend on serverless runtime limits except for normal app hosting.

## 12. Acceptance Criteria

The step is complete when:

- The page opens directly into the loader experience.
- A user can drag and drop one supported file.
- A user can select one supported file from the file picker.
- A user can paste text instead of uploading a file.
- Supported files show file name, extension, size, and `Input kind`.
- Pasted text shows character count, approximate word count, line count, and `Input kind: text`.
- Unsupported files show a friendly error.
- Oversized files show a friendly error.
- Empty files and empty pasted text show a friendly error.
- No raw file bytes are posted to a backend endpoint.
- The app can be deployed on Vercel Hobby/free without extra paid services.

## 13. Manual Test Cases

| Case | Expected result |
|---|---|
| Small `.csv` file | Accepted, `Input kind: sheets` |
| Semicolon `.csv` file | Accepted, `Input kind: sheets` |
| `.tsv` file | Accepted, `Input kind: sheets` |
| `.xlsx` file under 10 MB | Accepted, `Input kind: sheets` |
| `.ods` file under 10 MB | Accepted, `Input kind: sheets` |
| `.txt` report | Accepted, `Input kind: text` |
| `.md` report | Accepted, `Input kind: text` |
| `.log` file | Accepted, `Input kind: text` |
| `.docx` file under 10 MB | Accepted, `Input kind: text` |
| `.doc` file under 10 MB | Accepted, `Input kind: text` |
| `.pdf` file | Rejected as unsupported |
| Empty pasted text | Rejected as empty input |
| Empty file | Rejected as empty input |
| File above 10 MB | Rejected as too large |
| Two files dropped together | Rejected as multiple files |

## 14. Future Handoff

The output of this slice should feed the next project parts:

1. Sheet parsing and schema inference.
2. Text preprocessing.
3. Compact dataset profile generation.
4. AI narrative endpoint.
5. Chart recommendation and rendering.
6. Ask-the-data chat.

Do not overbuild this step. The loader should establish a clean input contract and a polished first interaction.
