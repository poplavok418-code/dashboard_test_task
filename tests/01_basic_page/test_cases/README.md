# 01 Basic Page Test Cases

These files are manual fixtures for the data-loader page.

The first loader step validates extension, size, emptiness, and input kind. It does not need to parse real XLS/XLSX/ODS/DOC/DOCX contents yet, so office-format fixtures are lightweight placeholder files with the correct extensions.

## Accepted Sheet Files

| File | Expected result |
|---|---|
| `accept_comma.csv` | Accepted, `Input kind: sheets` |
| `accept_semicolon.csv` | Accepted, `Input kind: sheets` |
| `accept_tab.tsv` | Accepted, `Input kind: sheets` |
| `accept_legacy.xls` | Accepted, `Input kind: sheets` |
| `accept_workbook.xlsx` | Accepted, `Input kind: sheets` |
| `accept_sheet.ods` | Accepted, `Input kind: sheets` |

## Accepted Text Files

| File | Expected result |
|---|---|
| `accept_report.txt` | Accepted, `Input kind: text` |
| `accept_markdown.md` | Accepted, `Input kind: text` |
| `accept_service.log` | Accepted, `Input kind: text` |
| `accept_document.docx` | Accepted, `Input kind: text` |
| `accept_legacy.doc` | Accepted, `Input kind: text` |

## Rejected Files

| File | Expected result |
|---|---|
| `reject_report.pdf` | Rejected as unsupported |
| `reject_image.png` | Rejected as unsupported |
| `reject_archive.zip` | Rejected as unsupported |
| `reject_empty.csv` | Rejected as empty input |
| `reject_too_large.csv` | Rejected as too large |

## Multiple File Case

Use both files together:

- `multi_one.csv`
- `multi_two.csv`

Expected result: rejected as multiple files.

## Text Paste Cases

These are in `.txt` files so they can be opened and pasted manually:

| File | Expected result after pasting |
|---|---|
| `paste_accept_text.txt` | Accepted, `Input kind: text` |
| `paste_empty_text.txt` | Rejected as empty input |
| `paste_too_large_text.txt` | Rejected as too large |

## MIME Hint Case

For generic MIME testing, upload `accept_generic_mime.csv` while forcing MIME to `application/octet-stream` in an automated test. Manual browser uploads usually choose MIME automatically, so this case is mainly for Playwright.

## Backend Upload Guard Case

`accept_private.csv` is used by the automated test that checks raw file bytes are not posted to backend endpoints.
