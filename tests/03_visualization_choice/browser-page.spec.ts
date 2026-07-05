import { expect, test, type Page } from "../../versions/02_input_preprocessing/node_modules/@playwright/test";
import path from "node:path";

const pagePath = process.env.VISUALIZATION_CHOICE_PAGE_PATH ?? "/";
const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const testCasesDir = path.resolve(process.cwd(), "tests/02_input_preprocessing/test_cases");

const TEST_IDS = {
  page: "data-loader-page",
  dropzone: "file-dropzone",
  fileInput: "file-input",
  pasteInput: "paste-text-input",
  result: "loader-result",
  error: "loader-error",
  visualizationType: "visualization-type",
} as const;

function fixturePath(name: string) {
  return path.join(testCasesDir, name);
}

function pageUrl() {
  return baseUrl ? new URL(pagePath, baseUrl).toString() : pagePath;
}

async function openPage(page: Page) {
  await page.goto(pageUrl());
  await expect(page.getByTestId(TEST_IDS.page)).toBeVisible();
  await expect(page.getByTestId(TEST_IDS.dropzone)).toBeVisible();
  await expect(page.getByTestId(TEST_IDS.pasteInput)).toBeVisible();
}

test.describe("03 browser page copied from 02", () => {
  test("opens into the Russian data-loader experience", async ({ page }) => {
    await openPage(page);

    await expect(page.getByTestId(TEST_IDS.page)).toContainText(/[А-Яа-яЁё]/);
    await expect(page.getByTestId(TEST_IDS.dropzone)).toContainText(
      /перетащите|файл|текст|таблиц|отчет/i,
    );
  });

  test("accepts a CSV file and shows only the visualization decision", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("profile_comma.csv"));

    await expect(page.getByTestId(TEST_IDS.result)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.result)).toContainText(/Решение по визуализации/i);
    await expect(page.getByTestId(TEST_IDS.visualizationType)).toHaveText(
      /bar_chart|line_chart|scatter_plot|histogram|pie_chart|donut_chart|heatmap|data_table|kpi_cards|no_reliable_visualization/,
    );
    await expect(page.getByText("Файл принят")).toHaveCount(0);
    await expect(page.getByTestId("preprocessing-summary")).toHaveCount(0);
  });

  test("rejects unsupported files with a Russian error", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("reject_report.pdf"));

    await expect(page.getByTestId(TEST_IDS.error)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.error)).toContainText(/[А-Яа-яЁё]/);
    await expect(page.getByTestId(TEST_IDS.error)).toContainText(/не поддерж|unsupported|pdf/i);
  });
});
