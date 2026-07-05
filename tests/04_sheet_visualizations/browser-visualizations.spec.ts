import { expect, test, type Page } from "../../versions/04_sheet_visualizations/node_modules/@playwright/test";
import path from "node:path";

const pagePath = process.env.SHEET_VISUALIZATIONS_PAGE_PATH ?? "/";
const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const testCasesDir = path.resolve(process.cwd(), "tests/04_sheet_visualizations/test_cases");

const TEST_IDS = {
  page: "data-loader-page",
  dropzone: "file-dropzone",
  fileInput: "file-input",
  pasteInput: "paste-text-input",
  removedDecisionPanel: "loader-result",
  error: "loader-error",
  visualizationType: "visualization-type",
  graphPanel: "graphplot-panel",
} as const;

const fixtures = [
  ["bar_chart_semicolon.csv", "bar_chart"],
  ["line_chart.xlsx", "line_chart"],
  ["scatter_plot.csv", "scatter_plot"],
  ["histogram.csv", "histogram"],
  ["pie_chart.csv", "pie_chart"],
  ["donut_chart.csv", "donut_chart"],
  ["heatmap.tsv", "heatmap"],
  ["data_table.csv", "data_table"],
  ["kpi_cards.csv", "kpi_cards"],
  ["no_reliable_visualization.csv", "no_reliable_visualization"],
] as const;

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

test.describe("04 sheet visualizations browser page", () => {
  for (const [fileName, expectedType] of fixtures) {
    test(`renders ${expectedType} from ${fileName}`, async ({ page }) => {
      await openPage(page);
      await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath(fileName));

      await expect(page.getByTestId(TEST_IDS.removedDecisionPanel)).toHaveCount(0);
      await expect(page.getByTestId(TEST_IDS.visualizationType)).toHaveText(expectedType);
      await expect(page.getByTestId(TEST_IDS.graphPanel)).toBeVisible();
      await expect(page.getByTestId(`graphplot-${expectedType}`)).toBeVisible();
    });
  }

  test("keeps Russian unsupported-file error", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("reject_report.pdf"));

    await expect(page.getByTestId(TEST_IDS.error)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.error)).toContainText(/[А-Яа-яЁё]/);
    await expect(page.getByTestId(TEST_IDS.error)).toContainText(/не поддерж|unsupported|pdf/i);
    await expect(page.getByTestId(TEST_IDS.graphPanel)).toHaveCount(0);
  });

  test("renders chart data from rows beyond the LLM-style preview", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("bar_chart_full_file_semicolon.csv"));

    await expect(page.getByTestId(TEST_IDS.visualizationType)).toHaveText("bar_chart");
    await expect(page.getByTestId("graphplot-bar_chart")).toBeVisible();
    await expect(page.getByTestId("graphplot-bar_chart")).toContainText(/Omega/);
    await expect(page.getByTestId("graphplot-bar_chart")).toContainText(/1[\s\u00a0]?000/);
  });

  test("lets users inspect chart marks", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("bar_chart_semicolon.csv"));

    await page.locator("rect[aria-label^='Analytics']").click();

    await expect(page.getByTestId("graphplot-active-value")).toContainText("Analytics");
    await expect(page.getByTestId("graphplot-active-value")).toContainText(/1[\s\u00a0]?800/);
  });

  test("filters rendered data tables", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("data_table.csv"));

    await page.getByTestId("graphplot-table-search").fill("blocked");

    await expect(page.getByTestId("graphplot-data_table")).toContainText("Waiting for source data");
    await expect(page.getByTestId("graphplot-data_table")).not.toContainText("Client asked for custom export");
    await expect(page.getByTestId("graphplot-data_table")).toContainText(/1\s*\/\s*3/);
  });
});
