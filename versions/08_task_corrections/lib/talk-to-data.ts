import type { AnalyzeRequestPayload, InsightContext, SheetInsightContext, SheetVisualizationContext, TextInsightContext } from "./data-insight";
import type { SuggestedVisualization } from "./suggested-visualization";

export const TALK_TO_DATA_LIMITS = {
  maxQuestionLength: 600,
};

export type TalkToDataRequest = {
  locale: "ru";
  question: string;
  insightContext: InsightContext;
  visualizationContext?: SheetVisualizationContext;
  analysis?: {
    insight?: string | null;
    visualizationType?: string | null;
  };
};

export type TalkToDataMessage = {
  answer: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  unavailableReason?: string;
};

export type TalkToDataValidation = {
  ok: true;
  question: string;
} | {
  ok: false;
  message: string;
  code: "empty_question" | "question_too_long";
};

export function validateTalkToDataQuestion(question: string): TalkToDataValidation {
  const normalized = question.trim();

  if (!normalized) {
    return { ok: false, code: "empty_question", message: "Напишите вопрос по данным." };
  }

  if (normalized.length > TALK_TO_DATA_LIMITS.maxQuestionLength) {
    return { ok: false, code: "question_too_long", message: "Сократите вопрос до 600 символов." };
  }

  return { ok: true, question: normalized };
}

export function buildTalkToDataRequest(
  question: string,
  payload: AnalyzeRequestPayload,
  selectedVisualization?: SuggestedVisualization | null,
  insight?: string | null,
): TalkToDataRequest {
  return {
    locale: "ru",
    question,
    insightContext: payload.insightContext,
    visualizationContext: payload.visualizationContext,
    analysis: {
      insight: insight ?? null,
      visualizationType: selectedVisualization?.type ?? null,
    },
  };
}

export function buildLocalTalkToDataAnswer(request: Pick<TalkToDataRequest, "question" | "insightContext" | "analysis">): TalkToDataMessage {
  const context = request.insightContext;
  const question = request.question.trim();

  if (context.sourceType === "text") {
    return buildLocalTextAnswer(request as Pick<TalkToDataRequest, "question" | "analysis"> & { insightContext: TextInsightContext });
  }

  const topCandidate = context.insightCandidates[0];
  const usefulColumns = context.columns
    .filter((column) => ["number", "category", "date", "boolean"].includes(column.inferredType))
    .map((column) => column.name)
    .slice(0, 4);
  const sampleHint = context.sample.rows[0]
    ? `В примере есть поля ${context.sample.columns.slice(0, 4).join(", ")}.`
    : "В компактном контексте нет строк примера.";
  const hasEvidence = Boolean(topCandidate || context.sample.rows[0] || usefulColumns.length > 0);
  const answer = hasEvidence ? [
    `LLM сейчас недоступен, поэтому показываю локальный ответ по профилю данных на вопрос: "${question}".`,
    `Таблица содержит ${context.rowCount.toLocaleString("ru-RU")} строк и ${context.columnCount.toLocaleString("ru-RU")} колонок.`,
    usefulColumns.length > 0
      ? `Для ответа выглядят полезными поля: ${usefulColumns.join(", ")}.`
      : "В профиле мало надежных аналитических полей.",
    topCandidate?.claim ?? request.analysis?.insight ?? "Сильного автоматического вывода в компактном профиле не найдено.",
    sampleHint,
  ].join(" ") : "В этом отчете нет такой информации.";

  return {
    answer,
    confidence: hasEvidence ? "low" : "low",
    evidence: [
      `Форма данных: ${context.rowCount} строк, ${context.columnCount} колонок.`,
      topCandidate?.evidence ?? "Использован компактный профиль и ограниченная выборка.",
    ],
    unavailableReason: hasEvidence
      ? "LLM-ответ временно недоступен; использован локальный fallback."
      : "В этом отчете нет такой информации.",
  };
}

function buildLocalTextAnswer(
  request: Pick<TalkToDataRequest, "question" | "analysis"> & { insightContext: TextInsightContext },
): TalkToDataMessage {
  const context = request.insightContext;
  const question = request.question.trim();
  const text = context.chunks.map((chunk) => chunk.text).join(" ").replace(/\s+/gu, " ").trim();
  const sentences = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/gu)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  const matchingSentences = sentences.filter((sentence) =>
    question
      .toLocaleLowerCase("ru-RU")
      .split(/\s+/u)
      .filter((word) => word.length >= 4)
      .some((word) => sentence.toLocaleLowerCase("ru-RU").includes(word)),
  );
  const evidenceSentences = (matchingSentences.length > 0 ? matchingSentences : sentences).slice(0, 3);

  const answer = evidenceSentences.length > 0 ? [
    `LLM сейчас недоступен, поэтому показываю локальный ответ по тексту на вопрос: "${question}".`,
    request.analysis?.insight ?? `Документ содержит примерно ${context.wordCountApprox.toLocaleString("ru-RU")} слов и ${context.paragraphCount.toLocaleString("ru-RU")} абзацев.`,
    `Наиболее близкие фрагменты: ${evidenceSentences.join(" ")}`,
  ].join(" ") : "В этом отчете нет такой информации.";

  return {
    answer,
    confidence: evidenceSentences.length > 0 ? "medium" : "low",
    evidence: evidenceSentences.length > 0
      ? evidenceSentences.map((sentence, index) => `Фрагмент ${index + 1}: ${sentence.slice(0, 180)}`)
      : ["Использован компактный текстовый профиль без табличных данных."],
    unavailableReason: evidenceSentences.length > 0
      ? "LLM-ответ временно недоступен; использован локальный fallback."
      : "В этом отчете нет такой информации.",
  };
}
