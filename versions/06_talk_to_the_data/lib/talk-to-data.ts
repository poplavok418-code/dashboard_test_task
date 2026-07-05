import type { AnalyzeRequestPayload, SheetInsightContext, SheetVisualizationContext } from "./data-insight";
import type { SuggestedVisualization } from "./suggested-visualization";

export const TALK_TO_DATA_LIMITS = {
  maxQuestionLength: 600,
};

export type TalkToDataRequest = {
  locale: "ru";
  question: string;
  insightContext: SheetInsightContext;
  visualizationContext: SheetVisualizationContext;
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
  selectedVisualization: SuggestedVisualization,
  insight?: string | null,
): TalkToDataRequest {
  return {
    locale: "ru",
    question,
    insightContext: payload.insightContext as SheetInsightContext,
    visualizationContext: payload.visualizationContext as SheetVisualizationContext,
    analysis: {
      insight: insight ?? null,
      visualizationType: selectedVisualization.type,
    },
  };
}

export function buildLocalTalkToDataAnswer(request: Pick<TalkToDataRequest, "question" | "insightContext" | "analysis">): TalkToDataMessage {
  const context = request.insightContext;
  const question = request.question.trim();
  const topCandidate = context.insightCandidates[0];
  const usefulColumns = context.columns
    .filter((column) => ["number", "category", "date", "boolean"].includes(column.inferredType))
    .map((column) => column.name)
    .slice(0, 4);
  const sampleHint = context.sample.rows[0]
    ? `В примере есть поля ${context.sample.columns.slice(0, 4).join(", ")}.`
    : "В компактном контексте нет строк примера.";
  const answer = [
    `LLM сейчас недоступен, поэтому показываю локальный ответ по профилю данных на вопрос: "${question}".`,
    `Таблица содержит ${context.rowCount.toLocaleString("ru-RU")} строк и ${context.columnCount.toLocaleString("ru-RU")} колонок.`,
    usefulColumns.length > 0
      ? `Для ответа выглядят полезными поля: ${usefulColumns.join(", ")}.`
      : "В профиле мало надежных аналитических полей.",
    topCandidate?.claim ?? request.analysis?.insight ?? "Сильного автоматического вывода в компактном профиле не найдено.",
    sampleHint,
  ].join(" ");

  return {
    answer,
    confidence: "low",
    evidence: [
      `Форма данных: ${context.rowCount} строк, ${context.columnCount} колонок.`,
      topCandidate?.evidence ?? "Использован компактный профиль и ограниченная выборка.",
    ],
    unavailableReason: "LLM-ответ временно недоступен; использован локальный fallback.",
  };
}
