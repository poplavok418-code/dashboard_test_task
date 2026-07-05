import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "versions/03_visualization_choice/index.mjs");
const promptPath = path.join(repoRoot, "prompts/visualization_agent_prompt.md");
const fixturesDir = path.join(repoRoot, "tests/03_visualization_choice/test_cases");

const expectedByFile = new Map([
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
]);

function candidateFor(type, candidates) {
  return candidates.find((candidate) => candidate.type === type) ?? candidates[0] ?? {};
}

function buildSuggestedVisualization(type, context) {
  const candidate = candidateFor(type, context.chartCandidates ?? []);
  const requiredColumns = [
    candidate.x,
    candidate.y,
    candidate.category,
    candidate.series,
    candidate.value,
  ].filter(Boolean);

  return {
    type,
    title: `Auto ${type}`,
    description: `Mock agent selected ${type} for ${context.fileName}.`,
    encoding: {
      x: candidate.x ?? null,
      y: candidate.y ?? null,
      category: candidate.category ?? null,
      series: candidate.series ?? null,
      value: candidate.value ?? candidate.y ?? null,
      aggregation: candidate.aggregation ?? null,
    },
    data_requirements: {
      required_columns: [...new Set(requiredColumns)],
      excluded_columns: context.columns
        .filter((column) => column.flags?.includes("id_like") || column.flags?.includes("high_cardinality"))
        .map((column) => column.name),
      filters: [],
      sort: {
        by: type === "line_chart" ? candidate.x ?? null : null,
        direction: type === "line_chart" ? "asc" : null,
      },
      limit: ["bar_chart", "pie_chart", "donut_chart", "heatmap"].includes(type) ? 8 : null,
      group_small_categories_as_other: type === "bar_chart",
    },
    display: {
      x_axis_label: candidate.x ?? candidate.category ?? null,
      y_axis_label: candidate.y ?? candidate.value ?? null,
      legend_title: candidate.series ?? null,
      value_format: "number",
    },
    fallback: {
      type: "data_table",
      reason: "Fallback to table if the selected columns fail validation.",
    },
    caveats: context.warnings?.map((warning) => warning.message) ?? [],
    chart_candidate_id: candidate.id ?? null,
  };
}

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
      assert.ok(payload.messages[0].content.includes("Visualization Selection Agent"));

      const userContent = JSON.parse(payload.messages.find((message) => message.role === "user").content);
      const context = userContent.datasetContext;
      const expectedType = expectedByFile.get(context.fileName);

      assert.ok(expectedType, `Unexpected fixture sent to mock LLM: ${context.fileName}`);
      assert.ok(context.sample.rows.length <= 50);
      assert.equal("rawRows" in context, false);

      const fullAgentOutput = {
        reasoning: {
          decision_path: [`Mock decision for ${expectedType}.`],
          selected_columns: {
            x: null,
            y: null,
            category: null,
            series: null,
            value: null,
          },
        },
        data_features: {
          row_count: context.rowCount,
          column_count: context.columnCount,
          detected_column_types: {
            date: context.columns.filter((column) => column.inferredType === "date").map((column) => column.name),
            number: context.columns.filter((column) => column.inferredType === "number").map((column) => column.name),
            category: context.columns.filter((column) => column.inferredType === "category").map((column) => column.name),
            text: context.columns.filter((column) => column.inferredType === "text").map((column) => column.name),
            boolean: context.columns.filter((column) => column.inferredType === "boolean").map((column) => column.name),
            mixed: context.columns.filter((column) => column.inferredType === "mixed").map((column) => column.name),
          },
          usable_dimensions: [],
          usable_measures: [],
          quality_notes: [],
        },
        suggested_visualization: buildSuggestedVisualization(expectedType, context),
      };

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(fullAgentOutput),
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
    const child = spawn(process.execPath, [cliPath, "--file", path.join(fixturesDir, fileName), "--prompt", promptPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NEURALDEEP_API_KEY: "test-key",
        NEURALDEEP_BASE_URL: baseUrl,
        LLM_MODEL: "gpt-oss-120b",
        LLM_MAX_TOKENS: "1200",
        LLM_TEMPERATURE: "0.2",
        NODE_PATH: path.join(repoRoot, "versions/02_input_preprocessing/node_modules"),
      },
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        status: null,
        signal: "SIGTERM",
        error: new Error("CLI timed out"),
        stdout,
        stderr,
      });
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
      resolve({
        status: null,
        signal: null,
        error,
        stdout,
        stderr,
      });
    });
    child.on("close", (status, signal) => {
      clearTimeout(timeout);
      resolve({
        status,
        signal,
        error: undefined,
        stdout,
        stderr,
      });
    });
  });
}

test("prints only suggested_visualization for every supported visualization type", async () => {
  const receivedRequests = [];
  const server = await startMockServer(receivedRequests);

  try {
    for (const [fileName, expectedType] of expectedByFile.entries()) {
      const result = await runCli(fileName, server.baseUrl);

      assert.equal(
        result.status,
        0,
        [
          `fixture=${fileName}`,
          `signal=${result.signal}`,
          `error=${result.error?.message ?? ""}`,
          `stderr=${result.stderr}`,
          `stdout=${result.stdout}`,
        ].join("\n"),
      );
      const output = JSON.parse(result.stdout);

      assert.equal(output.type, expectedType);
      assert.equal("suggested_visualization" in output, false);
      assert.equal("reasoning" in output, false);
      assert.equal("data_features" in output, false);
      assert.ok(output.encoding);
      assert.ok(output.data_requirements);
      assert.ok(Array.isArray(output.data_requirements.required_columns));
      assert.ok(output.display);
      assert.ok(output.fallback);
      assert.ok(Array.isArray(output.caveats));
    }

    assert.equal(receivedRequests.length, expectedByFile.size);
  } finally {
    await server.close();
  }
});

test("fails clearly when the API key is missing", () => {
  const result = spawnSync(process.execPath, [cliPath, "--file", path.join(fixturesDir, "histogram.csv"), "--prompt", promptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      NEURALDEEP_API_KEY: "",
      NODE_PATH: path.join(repoRoot, "versions/02_input_preprocessing/node_modules"),
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NEURALDEEP_API_KEY/);
});
