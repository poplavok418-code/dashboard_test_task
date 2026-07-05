import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { extractInsightResponse } from "../../versions/06_talk_to_the_data/lib/insight-response-parser.mjs";
import { callTalkToDataAgent } from "../../versions/06_talk_to_the_data/lib/llm-client.mjs";
import { extractTalkToDataResponse } from "../../versions/06_talk_to_the_data/lib/talk-response-parser.mjs";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "versions/06_talk_to_the_data/index.mjs");
const promptPath = path.join(repoRoot, "prompts/insight_agent_prompt.md");
const talkPromptPath = path.join(repoRoot, "prompts/talk_to_data_agent_prompt.md");
const fixturesDir = path.join(repoRoot, "tests/06_talk_to_the_data/test_cases");
const nodePath = path.join(repoRoot, "versions/04_sheet_visualizations/node_modules");

test("normalizes required insight JSON shape", () => {
  const output = extractInsightResponse(JSON.stringify({
    reasoning: "Used compact profile and top candidates.",
    insight: "Первая фраза. Вторая фраза. Третья фраза. Четвертая фраза. Пятая фраза.",
  }));

  assert.deepEqual(output, {
    reasoning: "Used compact profile and top candidates.",
    insight: "Первая фраза. Вторая фраза. Третья фраза. Четвертая фраза. Пятая фраза.",
  });
});

test("rejects an empty insight", () => {
  assert.throws(
    () => extractInsightResponse(JSON.stringify({ reasoning: "No signal.", insight: " " })),
    /insight/i,
  );
});

async function startMockServer(receivedRequests) {
  const server = http.createServer(async (request, response) => {
    try {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/v1/chat/completions");

      let body = "";
      for await (const chunk of request) {
        body += chunk;
      }

      const payload = JSON.parse(body);
      receivedRequests.push(payload);
      assert.equal(payload.model, "gpt-oss-120b");
      assert.equal(payload.temperature, 0.2);
      assert.ok(payload.messages[0].content.includes("Data Insight Agent"));

      const userContent = JSON.parse(payload.messages.find((message) => message.role === "user").content);
      assert.equal(userContent.locale, "ru");
      assert.equal(userContent.instruction, "Write a five-sentence insight. Return the full required JSON object.");

      const context = userContent.insightContext;
      assert.equal(context.sourceType, "sheet");
      assert.equal(context.fileName, "bar_chart_semicolon.csv");
      assert.equal("rawRows" in context, false);
      assert.equal("rows" in context, false);
      assert.ok(context.sample.rows.length <= 30);
      assert.ok(context.insightCandidates.length > 0);
      assert.ok(context.columns.some((column) => column.numericStats || column.categoryStats));

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reasoning: "Top category and totals were available in compact context.",
                insight:
                  "Таблица содержит 4 строки и показывает сравнение команд по числовому показателю. Самая заметная группа - Analytics с суммой 1800. Значения распределены неравномерно, потому что лидирующая группа заметно выше остальных. В данных достаточно структуры для сравнения категорий. Вывод стоит читать как обзор загруженной таблицы, а не как причинный анализ.",
              }),
            },
          },
        ],
      }));
    } catch (error) {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function runCli(fileName, baseUrl) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [cliPath, "--mode", "insight", "--file", path.join(fixturesDir, fileName), "--prompt", promptPath],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          LLM_API_KEY: "test-key",
          LLM_BASE_URL: baseUrl,
          LLM_MODEL: "gpt-oss-120b",
          LLM_MAX_TOKENS: "1200",
          LLM_TEMPERATURE: "0.2",
          NODE_PATH: nodePath,
        },
      },
    );
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ status: null, signal: "SIGTERM", error: new Error("CLI timed out"), stdout, stderr });
    }, 10_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ status: null, signal: null, error, stdout, stderr });
    });
    child.on("close", (status, signal) => {
      clearTimeout(timeout);
      resolve({ status, signal, error: undefined, stdout, stderr });
    });
  });
}

test("insight CLI sends compact context and prints only the insight block", async () => {
  const receivedRequests = [];
  const server = await startMockServer(receivedRequests);

  try {
    const result = await runCli("bar_chart_semicolon.csv", server.baseUrl);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);

    assert.deepEqual(Object.keys(output), ["reasoning", "insight"]);
    assert.match(output.reasoning, /Top category/);
    assert.match(output.insight, /Analytics/);
    assert.equal(receivedRequests.length, 1);
  } finally {
    await server.close();
  }
});

test("insight mode fails clearly when the API key is missing", () => {
  const result = spawnSync(
    process.execPath,
    [cliPath, "--mode", "insight", "--file", path.join(fixturesDir, "bar_chart_semicolon.csv"), "--prompt", promptPath],
    {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 10_000,
      env: {
        ...process.env,
        LLM_API_KEY: "",
        NEURALDEEP_API_KEY: "",
        NODE_PATH: nodePath,
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /LLM_API_KEY/);
});

test("normalizes talk-to-data JSON shape and defaults invalid confidence", () => {
  const output = extractTalkToDataResponse(JSON.stringify({
    answer: "По компактному профилю лидирует Analytics.",
    confidence: "certain",
    evidence: ["insightCandidates[0]", "", "sample.rows[0]"],
  }));

  assert.deepEqual(output, {
    answer: "По компактному профилю лидирует Analytics.",
    confidence: "low",
    evidence: ["insightCandidates[0]", "sample.rows[0]"],
    unavailableReason: undefined,
  });
});

test("rejects an empty talk-to-data answer", () => {
  assert.throws(
    () => extractTalkToDataResponse(JSON.stringify({ answer: " ", confidence: "low", evidence: [] })),
    /answer/i,
  );
});

async function startTalkMockServer(receivedRequests) {
  const server = http.createServer(async (request, response) => {
    try {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/v1/chat/completions");

      let body = "";
      for await (const chunk of request) {
        body += chunk;
      }

      const payload = JSON.parse(body);
      receivedRequests.push(payload);
      assert.equal(payload.model, "gpt-oss-120b");
      assert.ok(payload.messages[0].content.includes("Talk To Data Agent"));

      const userContent = JSON.parse(payload.messages.find((message) => message.role === "user").content);
      assert.equal(userContent.locale, "ru");
      assert.equal(userContent.question, "Кто лидирует по выручке?");
      assert.match(userContent.instruction, /provided data description and sample only/);

      const description = userContent.dataDescription;
      assert.equal(description.insightContext.sourceType, "sheet");
      assert.equal(description.insightContext.fileName, "bar_chart_semicolon.csv");
      assert.equal("rawRows" in description.insightContext, false);
      assert.equal("rows" in description.insightContext, false);
      assert.ok(description.insightContext.sample.rows.length <= 30);
      assert.ok(description.insightContext.columns.some((column) => column.numericStats || column.categoryStats));
      assert.ok(description.visualizationContext.chartCandidates.length > 0);

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                answer: "По переданному профилю лидирует Analytics.",
                confidence: "medium",
                evidence: ["group_numeric_leader", "sample rows"],
              }),
            },
          },
        ],
      }));
    } catch (error) {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("talk-to-data agent sends compact data description and bounded sample", async () => {
  const receivedRequests = [];
  const server = await startTalkMockServer(receivedRequests);
  const originalEnv = {
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL,
  };

  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = server.baseUrl;
  process.env.LLM_MODEL = "gpt-oss-120b";

  try {
    const prompt = await import("node:fs/promises").then((fs) => fs.readFile(talkPromptPath, "utf8"));
    const content = await callTalkToDataAgent({
      prompt,
      request: {
        locale: "ru",
        question: "Кто лидирует по выручке?",
        insightContext: {
          sourceType: "sheet",
          fileName: "bar_chart_semicolon.csv",
          rowCount: 4,
          columnCount: 2,
          columns: [
            {
              name: "team",
              inferredType: "category",
              nonEmptyCount: 4,
              missingCount: 0,
              uniqueCount: 3,
              examples: ["Analytics"],
              flags: [],
              categoryStats: { topValues: [{ label: "Analytics", count: 2, share: 0.5 }] },
            },
            {
              name: "revenue",
              inferredType: "number",
              nonEmptyCount: 4,
              missingCount: 0,
              uniqueCount: 4,
              examples: ["1000"],
              flags: [],
              numericStats: { min: 200, max: 1000, mean: 625, median: 650, sum: 2500 },
            },
          ],
          insightCandidates: [
            {
              type: "group_numeric_leader",
              claim: "Analytics лидирует по сумме revenue.",
              evidence: "team=Analytics, revenue=1800.",
              score: 0.94,
            },
          ],
          warnings: [],
          sample: {
            columns: ["team", "revenue"],
            rows: [["Analytics", "1000"], ["Sales", "500"]],
          },
        },
        visualizationContext: {
          sourceType: "sheet",
          fileName: "bar_chart_semicolon.csv",
          rowCount: 4,
          columnCount: 2,
          columns: [],
          sample: { columns: ["team", "revenue"], rows: [["Analytics", "1000"]] },
          chartCandidates: [{ id: "bar_chart_team_revenue", type: "bar_chart", reason: "Category plus numeric measure." }],
          warnings: [],
        },
        analysis: {
          insight: "Analytics лидирует по выручке.",
          visualizationType: "bar_chart",
        },
      },
    });
    const parsed = extractTalkToDataResponse(content);

    assert.equal(parsed.answer, "По переданному профилю лидирует Analytics.");
    assert.equal(parsed.confidence, "medium");
    assert.equal(receivedRequests.length, 1);
  } finally {
    if (originalEnv.apiKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = originalEnv.apiKey;
    if (originalEnv.baseUrl === undefined) delete process.env.LLM_BASE_URL;
    else process.env.LLM_BASE_URL = originalEnv.baseUrl;
    if (originalEnv.model === undefined) delete process.env.LLM_MODEL;
    else process.env.LLM_MODEL = originalEnv.model;
    await server.close();
  }
});
