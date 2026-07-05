import { expect, test, type Page } from "../../versions/04_sheet_visualizations/node_modules/@playwright/test";
import path from "node:path";

const pagePath = process.env.TASK_CORRECTIONS_PAGE_PATH ?? "/";
const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const testCasesDir = path.resolve(process.cwd(), "tests/08_task_corrections/test_cases");

const TEST_IDS = {
  page: "data-loader-page",
  dropzone: "file-dropzone",
  fileInput: "file-input",
  pasteInput: "paste-text-input",
  error: "loader-error",
  hero: "narrative-hero",
  heroInsight: "narrative-hero-insight",
  chartGrid: "dashboard-chart-grid",
  graphPanel: "graphplot-panel",
  visualizationType: "visualization-type",
  askPanel: "ask-data-panel",
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

test.describe("08 task corrections browser page", () => {
  test("renders separate hero, 2-3 dashboard widgets, and ask panel", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("bar_chart_semicolon.csv"));

    await expect(page.getByTestId(TEST_IDS.hero)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.heroInsight)).toContainText(/[А-Яа-яЁё]/);
    await expect(page.getByTestId(TEST_IDS.chartGrid)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.graphPanel)).toHaveCount(3);
    await expect(page.getByTestId(TEST_IDS.visualizationType).first()).toHaveText("bar_chart");
    await expect(page.getByTestId(TEST_IDS.askPanel)).toBeVisible();
  });

  test("keeps inherited line chart behavior while adding dashboard widgets", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("line_chart.xlsx"));

    await expect(page.getByTestId(TEST_IDS.hero)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.graphPanel).first()).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.visualizationType).first()).toHaveText("line_chart");
    await expect(page.getByTestId(TEST_IDS.graphPanel)).toHaveCount(3);
  });

  test("keeps unsupported-file error without dashboard", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("reject_report.pdf"));

    await expect(page.getByTestId(TEST_IDS.error)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.error)).toContainText(/[А-Яа-яЁё]/);
    await expect(page.getByTestId(TEST_IDS.hero)).toHaveCount(0);
    await expect(page.getByTestId(TEST_IDS.chartGrid)).toHaveCount(0);
    await expect(page.getByTestId(TEST_IDS.askPanel)).toHaveCount(0);
  });

  test("renders local fallback hero and dashboard when LLM analysis fails", async ({ page }) => {
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

    await expect(page.getByTestId(TEST_IDS.hero)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.chartGrid)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.llmFallbackWarning)).toBeVisible();
  });
});
