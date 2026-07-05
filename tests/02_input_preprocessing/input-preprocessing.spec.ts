import { expect, test, type Page } from "../../versions/02_input_preprocessing/node_modules/@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const pagePath = process.env.INPUT_PREPROCESSING_PAGE_PATH ?? "/";
const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const testCasesDir = path.resolve(process.cwd(), "tests/02_input_preprocessing/test_cases");

const TEST_IDS = {
  page: "data-loader-page",
  dropzone: "file-dropzone",
  fileInput: "file-input",
  pasteInput: "paste-text-input",
  result: "loader-result",
  error: "loader-error",
  summary: "preprocessing-summary",
  sheetProfiles: "sheet-profile-list",
  textChunks: "text-chunk-list",
  warnings: "data-warning-list",
} as const;

type TestFile = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

function fixturePath(name: string) {
  return path.join(testCasesDir, name);
}

function fixtureText(name: string) {
  return readFileSync(fixturePath(name), "utf8");
}

function fixturePayload(name: string, mimeType = "application/octet-stream"): TestFile {
  return {
    name,
    mimeType,
    buffer: readFileSync(fixturePath(name)),
  };
}

function loaderUrl() {
  return baseUrl ? new URL(pagePath, baseUrl).toString() : pagePath;
}

async function openLoader(page: Page) {
  await page.goto(loaderUrl());
  await expect(page.getByTestId(TEST_IDS.page)).toBeVisible();
  await expect(page.getByTestId(TEST_IDS.dropzone)).toBeVisible();
  await expect(page.getByTestId(TEST_IDS.pasteInput)).toBeVisible();
}

async function selectFile(page: Page, file: string | TestFile | Array<string | TestFile>) {
  await page.getByTestId(TEST_IDS.fileInput).setInputFiles(file);
}

async function expectAccepted(page: Page, expectedText: RegExp | string) {
  const result = page.getByTestId(TEST_IDS.result);
  await expect(result).toBeVisible();
  await expect(result).toContainText(/[А-Яа-яЁё]/);
  await expect(result).toContainText(/принят|готово|accepted/i);
  await expect(result).toContainText(expectedText);
}

async function expectRejected(page: Page, expectedText: RegExp | string) {
  const error = page.getByTestId(TEST_IDS.error);
  await expect(error).toBeVisible();
  await expect(error).toContainText(/[А-Яа-яЁё]/);
  await expect(error).toContainText(expectedText);
}

async function expectPreprocessingSummary(page: Page) {
  await expect(page.getByTestId(TEST_IDS.summary)).toBeVisible();
  await expect(page.getByTestId(TEST_IDS.summary)).toContainText(/[А-Яа-яЁё]/);
}

test.describe("02 input preprocessing", () => {
  test("opens directly into the Russian data-loader experience", async ({ page }) => {
    await openLoader(page);

    await expect(page.getByTestId(TEST_IDS.page)).toContainText(/[А-Яа-яЁё]/);
    await expect(page.getByTestId(TEST_IDS.dropzone)).toContainText(
      /перетащите|файл|текст|таблиц|отчет/i,
    );
  });

  test("rejects unsupported, empty, oversized, and multiple inputs", async ({ page }) => {
    await openLoader(page);
    await selectFile(page, fixturePath("reject_report.pdf"));
    await expectRejected(page, /не поддерж|unsupported|pdf/i);

    await page.getByRole("button", { name: /очистить/i }).click();
    await selectFile(page, fixturePath("reject_empty.csv"));
    await expectRejected(page, /пуст|empty/i);

    await page.getByRole("button", { name: /очистить/i }).click();
    await selectFile(page, fixturePath("reject_too_large.csv"));
    await expectRejected(page, /слишком|размер|лимит|large|limit/i);

    await page.getByRole("button", { name: /очистить/i }).click();
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles([
      fixturePath("profile_comma.csv"),
      fixturePath("profile_tab.tsv"),
    ]);
    await expectRejected(page, /один файл|несколько|multiple/i);
  });

  test("profiles comma CSV with rows, columns, types, and flags", async ({ page }) => {
    await openLoader(page);
    await selectFile(page, fixturePath("profile_comma.csv"));

    await expectAccepted(page, /\.csv/i);
    await expectPreprocessingSummary(page);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/profile_comma\.csv/i);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/3 строки/i);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/6 колон/i);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/number|date|category/i);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/id_like|pii_like/i);
  });

  test("detects semicolon CSV with Cyrillic text and decimal comma", async ({ page }) => {
    await openLoader(page);
    await selectFile(page, fixturePath("profile_semicolon_ru.csv"));

    await expectAccepted(page, /\.csv/i);
    await expectPreprocessingSummary(page);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/разделитель: ;/i);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/Москва|Казань/);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/number|date/i);
  });

  test("profiles TSV with tab delimiter", async ({ page }) => {
    await openLoader(page);
    await selectFile(page, fixturePath("profile_tab.tsv"));

    await expectAccepted(page, /\.tsv/i);
    await expectPreprocessingSummary(page);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/разделитель: tab/i);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/conversions|visits/i);
  });

  test("normalizes blank and duplicate headers", async ({ page }) => {
    await openLoader(page);
    await selectFile(page, fixturePath("headers_messy.csv"));

    await expectAccepted(page, /\.csv/i);
    await expectPreprocessingSummary(page);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/Column 2/i);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/Revenue 2/i);
  });

  test("shows warnings or flags for missing, high-cardinality, and ID-like data", async ({ page }) => {
    await openLoader(page);
    await selectFile(page, fixturePath("missing_values.csv"));

    await expectAccepted(page, /\.csv/i);
    await expectPreprocessingSummary(page);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/mostly_missing/i);

    await page.getByRole("button", { name: /очистить/i }).click();
    await selectFile(page, fixturePath("high_cardinality_ids.csv"));
    await expectAccepted(page, /\.csv/i);
    await expectPreprocessingSummary(page);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/high_cardinality/i);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/id_like/i);
  });

  test("treats workbook sheets as separate datasets and skips empty sheets", async ({ page }) => {
    await openLoader(page);
    await selectFile(page, fixturePath("multi_sheet_workbook.xlsx"));

    await expectAccepted(page, /\.xlsx/i);
    await expectPreprocessingSummary(page);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/Sales/);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).toContainText(/Operations/);
    await expect(page.getByTestId(TEST_IDS.sheetProfiles)).not.toContainText(/Empty Sheet[\s\S]*0 строки/);
    await expect(page.getByTestId(TEST_IDS.warnings)).toContainText(/пуст/i);
  });

  test("preprocesses short pasted text into one chunk", async ({ page }) => {
    await openLoader(page);
    await page.getByTestId(TEST_IDS.pasteInput).fill(fixtureText("short_report.txt"));

    await expectAccepted(page, /text/i);
    await expectPreprocessingSummary(page);
    await expect(page.getByTestId(TEST_IDS.textChunks)).toContainText(/1 фрагмент/i);
    await expect(page.getByTestId(TEST_IDS.textChunks)).toContainText(/Еженедельный отчет/);
  });

  test("chunks long text above 10000 characters instead of rejecting it", async ({ page }) => {
    await openLoader(page);
    await page.getByTestId(TEST_IDS.pasteInput).fill(fixtureText("long_report.txt"));

    await expectAccepted(page, /text/i);
    await expectPreprocessingSummary(page);
    await expect(page.getByTestId(TEST_IDS.textChunks)).toContainText(/[2-9]\s+фрагмент/i);
    await expect(page.getByTestId(TEST_IDS.warnings)).toContainText(/разделен|фрагмент/i);
  });

  test("hard-splits a very long paragraph within the chunk budget", async ({ page }) => {
    await openLoader(page);
    await page.getByTestId(TEST_IDS.pasteInput).fill(fixtureText("long_single_paragraph.txt"));

    await expectAccepted(page, /text/i);
    await expectPreprocessingSummary(page);
    await expect(page.getByTestId(TEST_IDS.textChunks)).toContainText(/[2-9]\s+фрагмент/i);
    await expect(page.getByTestId(TEST_IDS.textChunks)).toContainText(/до 10 000 символов/i);
  });

  test("preprocesses markdown and log text files", async ({ page }) => {
    await openLoader(page);
    await selectFile(page, fixturePath("markdown_report.md"));
    await expectAccepted(page, /\.md/i);
    await expectPreprocessingSummary(page);
    await expect(page.getByTestId(TEST_IDS.textChunks)).toContainText(/Итоги недели/);

    await page.getByRole("button", { name: /очистить/i }).click();
    await selectFile(page, fixturePath("service_report.log"));
    await expectAccepted(page, /\.log/i);
    await expectPreprocessingSummary(page);
    await expect(page.getByTestId(TEST_IDS.textChunks)).toContainText(/WARN slow response/);
  });

  test("does not post raw file bytes to backend endpoints", async ({ page }) => {
    const mutatingRequests: Array<{
      headers: Record<string, string>;
      body: string | null;
    }> = [];

    await page.route("**/*", async (route) => {
      const request = route.request();

      if (["POST", "PUT", "PATCH"].includes(request.method())) {
        mutatingRequests.push({
          headers: request.headers(),
          body: request.postData(),
        });
      }

      await route.continue();
    });

    await openLoader(page);
    await selectFile(page, fixturePayload("profile_comma.csv", "text/csv"));
    await expectAccepted(page, /\.csv/i);
    await expectPreprocessingSummary(page);

    for (const request of mutatingRequests) {
      expect(request.headers["content-type"] ?? "").not.toMatch(
        /multipart\/form-data|application\/octet-stream/i,
      );
      expect(request.body ?? "").not.toContain("customer_id,email");
      expect(request.body ?? "").not.toContain("a@example.com");
    }
  });
});
