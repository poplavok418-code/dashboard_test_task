# 01 Basic Page Tests

These tests target the first data-loader slice described in `specs/01_basic_page/data_loader_spec.md`.

They are written as Playwright tests and should be runnable after the Next.js app is implemented and Playwright is installed/configured.

The tests load files from `tests/01_basic_page/test_cases` instead of creating inline fixtures.

## Expected Test Hooks

The implementation should expose these stable hooks:

- `data-testid="data-loader-page"` on the main page container.
- `data-testid="file-dropzone"` on the drag-and-drop area.
- `data-testid="file-input"` on the file input.
- `data-testid="paste-text-input"` on the text input or textarea.
- `data-testid="loader-result"` on the accepted/result panel.
- `data-testid="loader-error"` on the error panel.

## Running

From the app project root:

```bash
npx playwright test tests/01_basic_page/data-loader.spec.ts
```

On Windows/PowerShell, you can use the launcher:

```powershell
.\tests\01_basic_page\run_data_loader_tests.ps1 -BaseUrl http://localhost:3000 -BasicPagePath /
```

Optional path override:

```bash
BASIC_PAGE_PATH=/ npx playwright test tests/01_basic_page/data-loader.spec.ts
```

## Coverage

There is one test per expected feature/case:

- Russian working page opens directly.
- Click-to-select upload works.
- Drag-and-drop upload works.
- Pasted text is accepted.
- Sheet formats are accepted: `.csv`, semicolon `.csv`, `.tsv`, `.xls`, `.xlsx`, `.ods`.
- Text formats are accepted: `.txt`, `.md`, `.log`, `.docx`, `.doc`.
- Unsupported inputs are rejected: `.pdf`, image, archive.
- Empty text and empty file are rejected.
- Oversized text and oversized file are rejected.
- Multiple files are rejected.
- Generic MIME values do not reject a supported extension.
- Raw file bytes are not posted to a backend endpoint.
