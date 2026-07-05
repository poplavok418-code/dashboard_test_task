import { expect, test, type Page } from "../../versions/04_sheet_visualizations/node_modules/@playwright/test";
import path from "node:path";

const pagePath = process.env.TALK_TO_DATA_PAGE_PATH ?? "/";
const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const testCasesDir = path.resolve(process.cwd(), "tests/06_talk_to_the_data/test_cases");

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
  askPanel: "ask-data-panel",
  askQuestion: "ask-data-question",
  askSubmit: "ask-data-submit",
  askAnswer: "ask-data-answer",
  askStatus: "ask-data-status",
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

test.describe("06 talk to the data browser page", () => {
  test("renders a Russian data insight, graph, and ask panel", async ({ page }) => {
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
    await expect(page.getByTestId(TEST_IDS.askPanel)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.askPanel)).toContainText("Спроси что-нибудь про эти данные");
  });

  test("keeps inherited line chart rendering with an insight", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("line_chart.xlsx"));

    await expect(page.getByTestId(TEST_IDS.insight)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.visualizationType)).toHaveText("line_chart");
    await expect(page.getByTestId("graphplot-line_chart")).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.askPanel)).toBeVisible();
  });

  test("keeps Russian unsupported-file error without graph or insight", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("reject_report.pdf"));

    await expect(page.getByTestId(TEST_IDS.error)).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.error)).toContainText(/[А-Яа-яЁё]/);
    await expect(page.getByTestId(TEST_IDS.graphPanel)).toHaveCount(0);
    await expect(page.getByTestId(TEST_IDS.insight)).toHaveCount(0);
    await expect(page.getByTestId(TEST_IDS.askPanel)).toHaveCount(0);
  });

  test("keeps full-row chart data while showing the insight", async ({ page }) => {
    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("bar_chart_full_file_semicolon.csv"));

    await expect(page.getByTestId(TEST_IDS.insight)).toBeVisible();
    await expect(page.getByTestId("graphplot-bar_chart")).toContainText(/Omega/);
    await expect(page.getByTestId("graphplot-bar_chart")).toContainText(/1[\s\u00a0]?000/);
    await expect(page.getByTestId(TEST_IDS.askPanel)).toBeVisible();
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

  test("submits a question and displays a mocked LLM answer", async ({ page }) => {
    let receivedBody: Record<string, unknown> | null = null;

    await page.route("**/api/chat", async (route) => {
      receivedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          message: {
            answer: "По переданному профилю лидирует Analytics.",
            confidence: "medium",
            evidence: ["insightCandidates", "sample.rows"],
          },
        }),
      });
    });

    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("bar_chart_semicolon.csv"));
    await expect(page.getByTestId(TEST_IDS.askPanel)).toBeVisible();
    await page.getByTestId(TEST_IDS.askQuestion).fill("Кто лидирует по выручке?");
    await page.getByTestId(TEST_IDS.askSubmit).click();

    await expect(page.getByTestId(TEST_IDS.askAnswer)).toContainText("Analytics");
    expect(receivedBody?.question).toBe("Кто лидирует по выручке?");
    expect((receivedBody?.insightContext as Record<string, unknown>)?.sourceType).toBe("sheet");
    expect("rawRows" in (receivedBody?.insightContext as Record<string, unknown>)).toBe(false);
  });

  test("rejects an empty question without calling chat API", async ({ page }) => {
    let chatCalls = 0;

    await page.route("**/api/chat", async (route) => {
      chatCalls += 1;
      await route.abort();
    });

    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("bar_chart_semicolon.csv"));
    await expect(page.getByTestId(TEST_IDS.askPanel)).toBeVisible();
    await page.getByTestId(TEST_IDS.askSubmit).click();

    await expect(page.getByTestId(TEST_IDS.askStatus)).toContainText("Напишите вопрос по данным.");
    expect(chatCalls).toBe(0);
  });

  test("shows local fallback answer when chat API fails", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "llm_unavailable", message: "Mocked broken key." },
        }),
      });
    });

    await openPage(page);
    await page.getByTestId(TEST_IDS.fileInput).setInputFiles(fixturePath("bar_chart_semicolon.csv"));
    await page.getByTestId(TEST_IDS.askQuestion).fill("Что видно по таблице?");
    await page.getByTestId(TEST_IDS.askSubmit).click();

    await expect(page.getByTestId(TEST_IDS.askStatus)).toContainText("Показан локальный ответ");
    await expect(page.getByTestId(TEST_IDS.askAnswer)).toContainText("LLM сейчас недоступен");
    await expect(page.getByTestId(TEST_IDS.askAnswer)).toContainText("Таблица содержит 4 строки");
  });
});
