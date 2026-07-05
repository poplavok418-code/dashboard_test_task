import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const pagePath = process.env.BASIC_PAGE_PATH ?? "/";
const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const testCasesDir = path.resolve(process.cwd(), "tests/01_basic_page/test_cases");

const TEST_IDS = {
  page: "data-loader-page",
  dropzone: "file-dropzone",
  fileInput: "file-input",
  pasteInput: "paste-text-input",
  result: "loader-result",
  error: "loader-error",
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

async function dropFile(page: Page, file: TestFile) {
  const dataTransfer = await page.evaluateHandle(
    ({ name, mimeType, bytes }) => {
      const transfer = new DataTransfer();
      const uploadedFile = new File([Uint8Array.from(bytes)], name, { type: mimeType });
      transfer.items.add(uploadedFile);
      return transfer;
    },
    {
      name: file.name,
      mimeType: file.mimeType,
      bytes: Array.from(file.buffer),
    },
  );

  const dropzone = page.getByTestId(TEST_IDS.dropzone);
  await dropzone.dispatchEvent("dragenter", { dataTransfer });
  await dropzone.dispatchEvent("dragover", { dataTransfer });
  await dropzone.dispatchEvent("drop", { dataTransfer });
  await dataTransfer.dispose();
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

test.describe("01 basic page data loader", () => {
  test("opens directly into the Russian data-loader experience", async ({ page }) => {
    await openLoader(page);

    await expect(page.getByTestId(TEST_IDS.page)).toContainText(/[А-Яа-яЁё]/);
    await expect(page.getByTestId(TEST_IDS.dropzone)).toContainText(
      /перетащите|файл|текст|таблиц|отчет/i,
    );
  });

  test("accepts a supported file selected from the file picker", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("accept_comma.csv"));

    await expectAccepted(page, /\.csv/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/sheets/i);
  });

  test("accepts a supported file via drag and drop", async ({ page }) => {
    await openLoader(page);

    await dropFile(page, fixturePayload("accept_report.txt", "text/plain"));

    await expectAccepted(page, /\.txt/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/text/i);
  });

  test("accepts pasted text and shows text metadata", async ({ page }) => {
    await openLoader(page);

    await page.getByTestId(TEST_IDS.pasteInput).fill(fixtureText("paste_accept_text.txt"));

    const result = page.getByTestId(TEST_IDS.result);
    await expectAccepted(page, /text/i);
    await expect(result).toContainText(/символ|character/i);
    await expect(result).toContainText(/слов|word/i);
    await expect(result).toContainText(/строк|line/i);
  });

  test("accepts comma CSV as sheets", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("accept_comma.csv"));

    await expectAccepted(page, /\.csv/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/sheets/i);
  });

  test("accepts semicolon CSV as sheets", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("accept_semicolon.csv"));

    await expectAccepted(page, /\.csv/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/sheets/i);
  });

  test("accepts TSV as sheets", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("accept_tab.tsv"));

    await expectAccepted(page, /\.tsv/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/sheets/i);
  });

  test("accepts XLS as sheets", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("accept_legacy.xls"));

    await expectAccepted(page, /\.xls/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/sheets/i);
  });

  test("accepts XLSX as sheets", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("accept_workbook.xlsx"));

    await expectAccepted(page, /\.xlsx/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/sheets/i);
  });

  test("accepts ODS as sheets", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("accept_sheet.ods"));

    await expectAccepted(page, /\.ods/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/sheets/i);
  });

  test("accepts TXT as text", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("accept_report.txt"));

    await expectAccepted(page, /\.txt/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/text/i);
  });

  test("accepts MD as text", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("accept_markdown.md"));

    await expectAccepted(page, /\.md/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/text/i);
  });

  test("accepts LOG as text", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("accept_service.log"));

    await expectAccepted(page, /\.log/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/text/i);
  });

  test("accepts DOCX as text metadata", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("accept_document.docx"));

    await expectAccepted(page, /\.docx/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/text/i);
  });

  test("accepts DOC as text metadata", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("accept_legacy.doc"));

    await expectAccepted(page, /\.doc/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/text/i);
  });

  test("rejects PDF as unsupported", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("reject_report.pdf"));

    await expectRejected(page, /не поддерж|unsupported|pdf/i);
  });

  test("rejects images as unsupported", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("reject_image.png"));

    await expectRejected(page, /не поддерж|unsupported|png|изображ/i);
  });

  test("rejects archives as unsupported", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("reject_archive.zip"));

    await expectRejected(page, /не поддерж|unsupported|zip|архив/i);
  });

  test("rejects empty pasted text", async ({ page }) => {
    await openLoader(page);

    await page.getByTestId(TEST_IDS.pasteInput).fill(fixtureText("paste_empty_text.txt"));

    await expectRejected(page, /пуст|empty/i);
  });

  test("rejects oversized pasted text", async ({ page }) => {
    await openLoader(page);

    await page.getByTestId(TEST_IDS.pasteInput).fill(fixtureText("paste_too_large_text.txt"));

    await expectRejected(page, /слишком|размер|лимит|large|limit/i);
  });

  test("rejects an empty file", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("reject_empty.csv"));

    await expectRejected(page, /пуст|empty/i);
  });

  test("rejects a file above the size limit", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePath("reject_too_large.csv"));

    await expectRejected(page, /слишком|размер|лимит|large|limit/i);
  });

  test("rejects multiple files at once", async ({ page }) => {
    await openLoader(page);

    await page.getByTestId(TEST_IDS.fileInput).setInputFiles([
      fixturePath("multi_one.csv"),
      fixturePath("multi_two.csv"),
    ]);

    await expectRejected(page, /один файл|несколько|multiple/i);
  });

  test("does not reject a supported extension with generic MIME type", async ({ page }) => {
    await openLoader(page);

    await selectFile(page, fixturePayload("accept_generic_mime.csv", "application/octet-stream"));

    await expectAccepted(page, /\.csv/i);
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/sheets/i);
  });

  test("does not post raw file bytes to backend endpoints", async ({ page }) => {
    const mutatingRequests: Array<{
      url: string;
      headers: Record<string, string>;
      body: string | null;
    }> = [];

    await page.route("**/*", async (route) => {
      const request = route.request();

      if (["POST", "PUT", "PATCH"].includes(request.method())) {
        mutatingRequests.push({
          url: request.url(),
          headers: request.headers(),
          body: request.postData(),
        });
      }

      await route.continue();
    });

    await openLoader(page);
    await selectFile(page, fixturePayload("accept_private.csv", "text/csv"));
    await expectAccepted(page, /\.csv/i);

    for (const request of mutatingRequests) {
      expect(request.headers["content-type"] ?? "").not.toMatch(
        /multipart\/form-data|application\/octet-stream/i,
      );
      expect(request.body ?? "").not.toContain("raw-secret");
      expect(request.body ?? "").not.toContain("secret_column,value");
    }
  });
});
