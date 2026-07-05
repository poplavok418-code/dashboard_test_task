import { expect, test, type Page } from "../../versions/04_sheet_visualizations/node_modules/@playwright/test";
import path from "node:path";

const pagePath = process.env.DATA_INSIGHT_PAGE_PATH ?? "/";
const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const testCasesDir = path.resolve(process.cwd(), "tests/05_data_insight/test_cases");

const TEST_IDS = {
  page: "data-loader-page",
  dropzone: "file-dropzone",
  fileInput: "file-input",
  pasteInput: "paste-text-input",
  error: "loader-error",
  visualizationType: "visualization-type",
  graphPanel: "graphplot-panel",
  insight: "data-insight",
  analysisStatus: "analysis-status",
  llmFallbackWarning: "llm-fallback-warning",
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

test.describe("05 data insight browser page", () => {
  test("renders a Russian data insight above the graph", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("bar_chart_semicolon.csv"));

    await expect(page.getByTestId(TEST_IDS.graphPanel)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.insight)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.insight)).toContainText(/[А-Яа-яЁё]/);
    await expect(page.getByTestId(TEST_IDS.insight)).toContainText("Таблица содержит 4 строки и 2 колонки.");
    await expect(page.getByTestId(TEST_IDS.insight)).toContainText(/Analytics|таблиц|строк/i);
    await expect(page.getByTestId(TEST_IDS.analysisStatus)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.visualizationType)).toHaveText("bar_chart");
    await expect(page.getByTestId("graphplot-bar_chart")).toBeVisible();
  });

  test("keeps inherited line chart rendering with an insight", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("line_chart.xlsx"));

    await expect(page.getByTestId(TEST_IDS.insight)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.visualizationType)).toHaveText("line_chart");
    await expect(page.getByTestId("graphplot-line_chart")).toBeVisible();
  });

  test("keeps Russian unsupported-file error without graph or insight", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("reject_report.pdf"));

    await expect(page.getByTestId(TEST_IDS.error)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.error)).toContainText(/[А-Яа-яЁё]/);
    await expect(page.getByTestId(TEST_IDS.graphPanel)).toHaveCount(0);
    await expect(page.getByTestId(TEST_IDS.insight)).toHaveCount(0);
  });

  test("keeps full-row chart data while showing the insight", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("bar_chart_full_file_semicolon.csv"));

    await expect(page.getByTestId(TEST_IDS.insight)).toBeVisible();
    await expect(page.getByTestId("graphplot-bar_chart")).toContainText(/Omega/);
    await expect(page.getByTestId("graphplot-bar_chart")).toContainText(/1[\s\u00a0]?000/);
  });

  test("shows an explicit warning when LLM output is not used", async ({ page }) => {
    await page.route("**/api/analyze", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          insight: null,
          suggestedVisualization: null,
          errors: ["Mocked LLM failure."],
        }),
      });
    });

    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("bar_chart_semicolon.csv"));

    await expect(page.getByTestId(TEST_IDS.llmFallbackWarning)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.llmFallbackWarning)).toContainText("LLM сейчас не использован");
    await expect(page.getByTestId(TEST_IDS.llmFallbackWarning)).toContainText("локальный детерминированный анализ");
  });
});
