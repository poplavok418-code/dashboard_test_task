import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type AgentResult<T> = {
  value: T | null;
  error: string | null;
};

const VISUALIZATION_TYPES = new Set([
  "bar_chart",
  "line_chart",
  "scatter_plot",
  "histogram",
  "pie_chart",
  "donut_chart",
  "heatmap",
  "data_table",
  "kpi_cards",
  "no_reliable_visualization",
]);

let envLoadPromise: Promise<void> | null = null;

function numberFromEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function endpointUrl() {
  if (process.env.LLM_CHAT_COMPLETIONS_URL) {
    return process.env.LLM_CHAT_COMPLETIONS_URL;
  }

  if (process.env.NEURALDEEP_CHAT_COMPLETIONS_URL) {
    return process.env.NEURALDEEP_CHAT_COMPLETIONS_URL;
  }

  const baseUrl = process.env.LLM_BASE_URL || process.env.NEURALDEEP_BASE_URL || "https://llm.c2devel.ru/v1";
  return `${baseUrl.replace(/\/$/u, "")}/chat/completions`;
}

function apiKey() {
  return process.env.LLM_API_KEY || process.env.NEURALDEEP_API_KEY;
}

function model() {
  return process.env.LLM_MODEL || "k2tex/qwen3.6-35b";
}

function thinkingEnabled() {
  return process.env.LLM_ENABLE_THINKING === "true";
}

async function loadRepoEnv() {
  if (envLoadPromise) {
    return envLoadPromise;
  }

  envLoadPromise = (async () => {
    const envPath = path.resolve(process.cwd(), "..", "..", ".env");
    const keysFromOuterEnv = new Set(Object.keys(process.env));

    try {
      const body = await readFile(envPath, "utf8");

      for (const line of body.split(/\r?\n/u)) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
          continue;
        }

        const separatorIndex = trimmed.indexOf("=");

        if (separatorIndex <= 0) {
          continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const rawValue = trimmed.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^["']|["']$/gu, "");

        if (!keysFromOuterEnv.has(key)) {
          process.env[key] = value;
        }
      }
    } catch {
      // Next may already have loaded env vars; absence of the repo .env is handled by callAgent.
    }
  })();

  return envLoadPromise;
}

async function callAgent(prompt: string, userPayload: unknown) {
  await loadRepoEnv();

  const key = apiKey();

  if (!key) {
    throw new Error("LLM_API_KEY is not set.");
  }

  const messages: ChatMessage[] = [
    { role: "system", content: prompt },
    { role: "user", content: JSON.stringify(userPayload) },
  ];
  const response = await fetch(endpointUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model(),
      messages,
      max_tokens: numberFromEnv("LLM_MAX_TOKENS", 1200),
      temperature: numberFromEnv("LLM_TEMPERATURE", 0.2),
      chat_template_kwargs: {
        enable_thinking: thinkingEnabled(),
      },
    }),
    signal: AbortSignal.timeout(numberFromEnv("LLM_TIMEOUT_MS", 15_000)),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`LLM request failed with ${response.status}: ${body.slice(0, 180)}`);
  }

  const json = JSON.parse(body);
  const content = json?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("LLM response did not contain message content.");
  }

  return content;
}

function extractJsonText(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response is not valid JSON.");
  }

  return trimmed.slice(start, end + 1);
}

function parseInsight(text: string) {
  const parsed = JSON.parse(extractJsonText(text));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Insight response must be an object.");
  }

  if (typeof parsed.reasoning !== "string") {
    throw new Error("Insight response reasoning must be a string.");
  }

  const insight = typeof parsed.insight === "string" ? parsed.insight : (parsed as Record<string, unknown>).ins;

  if (typeof insight !== "string" || insight.trim().length === 0) {
    throw new Error("Insight response insight must be a non-empty string.");
  }

  return {
    reasoning: parsed.reasoning.trim(),
    insight: insight.trim(),
  };
}

function normalizeVisualization(block: Record<string, unknown>) {
  const encoding = block.encoding && typeof block.encoding === "object" ? block.encoding as Record<string, unknown> : {};
  const dataRequirements = block.data_requirements && typeof block.data_requirements === "object"
    ? block.data_requirements as Record<string, unknown>
    : {};
  const sort = dataRequirements.sort && typeof dataRequirements.sort === "object"
    ? dataRequirements.sort as Record<string, unknown>
    : {};
  const display = block.display && typeof block.display === "object" ? block.display as Record<string, unknown> : {};
  const fallback = block.fallback && typeof block.fallback === "object" ? block.fallback as Record<string, unknown> : {};
  const type = typeof block.type === "string" && VISUALIZATION_TYPES.has(block.type) ? block.type : "data_table";

  return {
    type,
    title: typeof block.title === "string" ? block.title : "",
    description: typeof block.description === "string" ? block.description : "",
    encoding: {
      x: typeof encoding.x === "string" ? encoding.x : null,
      y: typeof encoding.y === "string" ? encoding.y : null,
      category: typeof encoding.category === "string" ? encoding.category : null,
      series: typeof encoding.series === "string" ? encoding.series : null,
      value: typeof encoding.value === "string" ? encoding.value : null,
      aggregation: typeof encoding.aggregation === "string" ? encoding.aggregation : null,
    },
    data_requirements: {
      required_columns: Array.isArray(dataRequirements.required_columns)
        ? dataRequirements.required_columns.filter((item): item is string => typeof item === "string")
        : [],
      excluded_columns: Array.isArray(dataRequirements.excluded_columns)
        ? dataRequirements.excluded_columns.filter((item): item is string => typeof item === "string")
        : [],
      filters: Array.isArray(dataRequirements.filters) ? dataRequirements.filters : [],
      sort: {
        by: typeof sort.by === "string" ? sort.by : null,
        direction: sort.direction === "asc" || sort.direction === "desc" ? sort.direction : null,
      },
      limit: typeof dataRequirements.limit === "number" && Number.isFinite(dataRequirements.limit) ? dataRequirements.limit : null,
      group_small_categories_as_other: dataRequirements.group_small_categories_as_other === true,
    },
    display: {
      x_axis_label: typeof display.x_axis_label === "string" ? display.x_axis_label : null,
      y_axis_label: typeof display.y_axis_label === "string" ? display.y_axis_label : null,
      legend_title: typeof display.legend_title === "string" ? display.legend_title : null,
      value_format: typeof display.value_format === "string" ? display.value_format : null,
    },
    fallback: {
      type: fallback.type === "no_reliable_visualization" ? "no_reliable_visualization" : "data_table",
      reason: typeof fallback.reason === "string" ? fallback.reason : "",
    },
    caveats: Array.isArray(block.caveats) ? block.caveats.filter((item): item is string => typeof item === "string") : [],
    chart_candidate_id: typeof block.chart_candidate_id === "string" ? block.chart_candidate_id : null,
  };
}

function parseVisualization(text: string) {
  const parsed = JSON.parse(extractJsonText(text));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Visualization response must be an object.");
  }

  const block = "suggested_visualization" in parsed
    ? (parsed as Record<string, unknown>).suggested_visualization
    : parsed;

  if (!block || typeof block !== "object" || Array.isArray(block)) {
    throw new Error("suggested_visualization must be an object.");
  }

  return normalizeVisualization(block as Record<string, unknown>);
}

async function runAgent<T>(task: () => Promise<T>): Promise<AgentResult<T>> {
  try {
    return { value: await task(), error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : "Unknown LLM error." };
  }
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const insightContext = (payload as Record<string, unknown>).insightContext;
  const visualizationContext = (payload as Record<string, unknown>).visualizationContext;
  const isTextInsight = insightContext &&
    typeof insightContext === "object" &&
    (insightContext as Record<string, unknown>).sourceType === "text";

  if (!insightContext || (!isTextInsight && !visualizationContext)) {
    return NextResponse.json({ ok: false, error: "Missing insightContext or visualizationContext." }, { status: 400 });
  }

  const insightPrompt = await readFile(path.resolve(process.cwd(), "..", "..", "prompts", "insight_agent_prompt.md"), "utf8");

  if (isTextInsight) {
    const insightResult = await runAgent(async () => {
      const response = await callAgent(insightPrompt, {
        locale: "ru",
        instruction: "Summarize the provided text in 2-3 Russian sentences. Return the full required JSON object.",
        insightContext,
      });
      return parseInsight(response);
    });

    return NextResponse.json({
      ok: true,
      insight: insightResult.value,
      suggestedVisualization: null,
      errors: [insightResult.error].filter(Boolean),
    });
  }

  const visualizationPrompt = await readFile(path.resolve(process.cwd(), "..", "..", "prompts", "visualization_agent_prompt.md"), "utf8");

  const [insightResult, visualizationResult] = await Promise.all([
    runAgent(async () => {
      const response = await callAgent(insightPrompt, {
        locale: "ru",
        instruction: "Write a 2-3 sentence insight. Return the full required JSON object.",
        insightContext,
      });
      return parseInsight(response);
    }),
    runAgent(async () => {
      const response = await callAgent(visualizationPrompt, {
        locale: "ru",
        instruction: "Choose the best visualization. Return the full required JSON object.",
        datasetContext: visualizationContext,
      });
      return parseVisualization(response);
    }),
  ]);

  return NextResponse.json({
    ok: true,
    insight: insightResult.value,
    suggestedVisualization: visualizationResult.value,
    errors: [insightResult.error, visualizationResult.error].filter(Boolean),
  });
}
