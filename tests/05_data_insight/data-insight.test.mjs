import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { extractInsightResponse } from "../../versions/05_data_insight/lib/insight-response-parser.mjs";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "versions/05_data_insight/index.mjs");
const promptPath = path.join(repoRoot, "prompts/insight_agent_prompt.md");
const fixturesDir = path.join(repoRoot, "tests/05_data_insight/test_cases");
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
          NEURALDEEP_API_KEY: "test-key",
          NEURALDEEP_BASE_URL: baseUrl,
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
        NEURALDEEP_API_KEY: "",
        NODE_PATH: nodePath,
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NEURALDEEP_API_KEY/);
});
