# 02 Input Preprocessing Implementation Report

## Implemented Features

- Created `02_input_preprocessing` as a self-contained version based on `01_basic_page`.
- Added local CSV/TSV preprocessing with delimiter detection, header cleanup, row/column cleanup, preview rows, and column profiles.
- Added workbook preprocessing for `.xls`, `.xlsx`, and `.ods`, treating each visible non-empty sheet as a separate dataset.
- Added text preprocessing for pasted text, `.txt`, `.md`, and `.log`, including normalization, stats, and chunking over `10_000` characters.
- Kept `.doc` and `.docx` accepted with a clear unsupported-extraction preprocessing warning.
- Added Russian UI panels for preprocessing summaries, sheet profiles, text chunks, and data warnings.
- Added v02 fixtures, Playwright coverage, and utility tests.

## Files And Folders Created

- `specs/02_input_preprocessing/input_preprocessing_spec.md`
- `specs/02_input_preprocessing/implementation_report.md`
- `tests/02_input_preprocessing/input-preprocessing.spec.ts`
- `tests/02_input_preprocessing/preprocessing-unit.spec.ts`
- `tests/02_input_preprocessing/run_02_input_preprocessing_tests.ps1`
- `tests/02_input_preprocessing/test_cases/`
- `versions/02_input_preprocessing/`

## Test Commands Run

```powershell
cd versions/02_input_preprocessing
npm install
npm run typecheck
npm run build
npm run dev
cd ../..
.\tests\02_input_preprocessing\run_02_input_preprocessing_tests.ps1 -BaseUrl http://localhost:3001 -PagePath /
cd versions/02_input_preprocessing
npm run typecheck
npm run build
```

## Results

- Typecheck: passed.
- Production build: passed.
- Final automated tests: 16 total, 16 passed, 0 failed.

## Issues And Fixes

- Initial `npm install` failed in the sandbox because registry/cache access was blocked. Reran with approved escalation and installed `papaparse` and `xlsx`.
- First Playwright run could not resolve `@playwright/test` from root-level tests. Updated the v02 runner/tests to use the version-local Playwright dependency.
- First full test run had 13 passed and 3 failed:
  - Sheet examples were not visible in the UI. Added original-value examples to column badges.
  - The blank-header fixture used a fully empty column, which was correctly dropped. Updated the fixture so the blank header column contains data.
  - The long-text fixture exceeded the hard `100_000` character limit. Reduced it to stay above `10_000` and below the hard limit.
- Second full test run had 15 passed and 1 failed:
  - Cyrillic examples were displayed lowercased. Updated table profiling to preserve original example casing.

## Known Limitations

- `.doc` and `.docx` extraction are not implemented in this version.
- Workbook parsing is browser-side and limited by device memory.
- Column inference is heuristic and conservative.
- Charts, LLM summaries, and chat remain out of scope for this release.
