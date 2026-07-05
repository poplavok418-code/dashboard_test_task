import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { validateTalkToDataQuestion, type TalkToDataRequest } from "@/lib/talk-to-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let envLoadPromise: Promise<void> | null = null;

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
      // Next may already have loaded env vars; absence is handled by the LLM call.
    }
  })();

  return envLoadPromise;
}

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

function normalizeMessage(text: string) {
  const parsed = JSON.parse(extractJsonText(text));
  const confidence = ["high", "medium", "low"].includes(parsed?.confidence) ? parsed.confidence : "low";

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Talk-to-data response must be an object.");
  }

  if (typeof parsed.answer !== "string" || parsed.answer.trim().length === 0) {
    throw new Error("Talk-to-data response answer must be a non-empty string.");
  }

  return {
    answer: parsed.answer.trim(),
    confidence,
    evidence: Array.isArray(parsed.evidence)
      ? parsed.evidence.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 5)
      : [],
    unavailableReason: typeof parsed.unavailableReason === "string" && parsed.unavailableReason.trim().length > 0
      ? parsed.unavailableReason.trim()
      : undefined,
  };
}

function validateRequest(payload: unknown): { ok: true; request: TalkToDataRequest } | { ok: false; status: number; code: string; message: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, status: 400, code: "invalid_json", message: "Некорректный JSON-запрос." };
  }

  const candidate = payload as Partial<TalkToDataRequest>;

  if (candidate.locale !== "ru") {
    return { ok: false, status: 400, code: "invalid_locale", message: "Поддерживается только русский язык интерфейса." };
  }

  const question = validateTalkToDataQuestion(typeof candidate.question === "string" ? candidate.question : "");

  if (!question.ok) {
    return { ok: false, status: 400, code: question.code, message: question.message };
  }

  if (!candidate.insightContext || (candidate.insightContext.sourceType !== "sheet" && candidate.insightContext.sourceType !== "text")) {
    return { ok: false, status: 400, code: "invalid_context", message: "Нужен компактный профиль данных или текста." };
  }

  if (candidate.insightContext.sourceType === "sheet" && (!candidate.visualizationContext || candidate.visualizationContext.sourceType !== "sheet")) {
    return { ok: false, status: 400, code: "invalid_visualization_context", message: "Нужен контекст визуализации." };
  }

  return {
    ok: true,
    request: {
      locale: "ru",
      question: question.question,
      insightContext: candidate.insightContext,
      visualizationContext: candidate.visualizationContext,
      analysis: candidate.analysis,
    },
  };
}

async function callAgent(prompt: string, request: TalkToDataRequest) {
  await loadRepoEnv();

  const key = apiKey();

  if (!key) {
    throw new Error("LLM_API_KEY is not set.");
  }

  const response = await fetch(endpointUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model(),
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: JSON.stringify({
            locale: request.locale,
            instruction: "Answer the user question from the provided data description and sample only. If the evidence is missing, say: В этом отчете нет такой информации. Return the full required JSON object.",
            question: request.question,
            dataDescription: {
              insightContext: request.insightContext,
              visualizationContext: request.visualizationContext ?? null,
              analysis: request.analysis ?? null,
            },
          }),
        },
      ],
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

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const validation = validateRequest(payload);

  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: { code: validation.code, message: validation.message } },
      { status: validation.status },
    );
  }

  try {
    const prompt = await readFile(path.resolve(process.cwd(), "..", "..", "prompts", "talk_to_data_agent_prompt.md"), "utf8");
    const content = await callAgent(prompt, validation.request);

    return NextResponse.json({ ok: true, message: normalizeMessage(content) });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "llm_unavailable",
          message: error instanceof Error ? error.message : "LLM-ответ временно недоступен.",
        },
      },
      { status: 503 },
    );
  }
}
