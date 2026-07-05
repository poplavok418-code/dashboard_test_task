"use client";

import type { LoaderResult } from "@/lib/accepted-inputs";
import {
  buildAnalyzeRequestPayload,
  buildLocalInsight,
  buildLocalTextInsight,
  buildTextAnalyzeRequestPayload,
} from "@/lib/data-insight";
import { selectVisualization } from "@/lib/select-visualization";
import { buildGraphPlot } from "@/lib/graph-plot";
import { makeSuggestedVisualization, type SuggestedVisualization } from "@/lib/suggested-visualization";
import type { SheetDatasetProfile } from "@/lib/input-preprocessing-types";
import { useEffect, useMemo, useState } from "react";
import { buildTalkToDataRequest } from "@/lib/talk-to-data";
import { AskDataChat } from "./AskDataChat";
import { VisualizationPanel } from "./VisualizationPanel";

type LoaderResultPanelProps = {
  result: LoaderResult | null;
};

type ApiAnalysis = {
  ok: boolean;
  insight?: {
    reasoning: string;
    insight: string;
  } | null;
  suggestedVisualization?: SuggestedVisualization | null;
  errors?: string[];
};

type AnalysisState = {
  status: "idle" | "loading" | "llm" | "fallback";
  insight: string | null;
  suggestedVisualization: SuggestedVisualization | null;
  errors: string[];
};

export function LoaderResultPanel({ result }: LoaderResultPanelProps) {
  const [analysis, setAnalysis] = useState<AnalysisState>({
    status: "idle",
    insight: null,
    suggestedVisualization: null,
    errors: [],
  });

  const dataset = result?.preprocessing?.kind === "sheets" ? bestDataset(result.preprocessing.datasets) : undefined;
  const textPreprocessing = result?.preprocessing?.kind === "text" ? result.preprocessing : undefined;
  const decision = useMemo(() => selectVisualization(result?.preprocessing), [result?.preprocessing]);
  const localSuggestedVisualization = useMemo(
    () => makeSuggestedVisualization(decision, dataset),
    [decision, dataset],
  );
  const localInsight = useMemo(
    () => {
      if (result?.preprocessing?.kind === "sheets") {
        return buildLocalInsight(dataset);
      }

      if (result?.preprocessing?.kind === "text") {
        return buildLocalTextInsight(result.preprocessing);
      }

      return undefined;
    },
    [dataset, result?.preprocessing],
  );
  const analyzeRequestPayload = useMemo(
    () => {
      if (dataset) {
        return buildAnalyzeRequestPayload(dataset, localSuggestedVisualization);
      }

      if (textPreprocessing) {
        return buildTextAnalyzeRequestPayload(
          textPreprocessing,
          result?.file?.name ?? (result?.source === "pasted_text" ? "вставленный текст" : "text"),
        );
      }

      return null;
    },
    [dataset, localSuggestedVisualization, result?.file?.name, result?.source, textPreprocessing],
  );

  useEffect(() => {
    if (!analyzeRequestPayload || result?.status !== "accepted") {
      setAnalysis({ status: "idle", insight: null, suggestedVisualization: null, errors: [] });
      return;
    }

    let active = true;
    const controller = new AbortController();
    const activePayload = analyzeRequestPayload;

    setAnalysis({ status: "loading", insight: null, suggestedVisualization: null, errors: [] });

    async function runAnalyze() {
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(activePayload),
          signal: controller.signal,
        });
        const payload = await response.json() as ApiAnalysis;

        if (!active) {
          return;
        }

        if (!response.ok || !payload.ok) {
          setAnalysis({
            status: "fallback",
            insight: null,
            suggestedVisualization: null,
            errors: payload.errors ?? ["LLM-анализ временно недоступен."],
          });
          return;
        }

        setAnalysis({
          status: payload.insight || payload.suggestedVisualization ? "llm" : "fallback",
          insight: payload.insight?.insight ?? null,
          suggestedVisualization: payload.suggestedVisualization ?? null,
          errors: payload.errors ?? [],
        });
      } catch (error) {
        if (!active || controller.signal.aborted) {
          return;
        }

        setAnalysis({
          status: "fallback",
          insight: null,
          suggestedVisualization: null,
          errors: [error instanceof Error ? error.message : "LLM-анализ временно недоступен."],
        });
      }
    }

    void runAnalyze();

    return () => {
      active = false;
      controller.abort();
    };
  }, [analyzeRequestPayload, result?.status]);

  if (!result || result.status !== "accepted") {
    return null;
  }

  const suggestedVisualization = analysis.suggestedVisualization ?? localSuggestedVisualization;
  const graphPlot = buildGraphPlot(dataset, suggestedVisualization);
  const insight = analysis.insight ?? localInsight;
  const hasAnalyzableInput = Boolean(dataset || textPreprocessing);
  const llmWasNotUsed = hasAnalyzableInput && analysis.status === "fallback";
  const askDataRequest = dataset && analyzeRequestPayload
    ? buildTalkToDataRequest("", analyzeRequestPayload, suggestedVisualization, insight)
    : null;

  return (
    <div className="grid gap-3">
      <VisualizationPanel plot={graphPlot} insight={insight} />
      {askDataRequest ? (
        <AskDataChat
          requestBase={{
            locale: askDataRequest.locale,
            insightContext: askDataRequest.insightContext,
            visualizationContext: askDataRequest.visualizationContext,
            analysis: askDataRequest.analysis,
          }}
        />
      ) : null}
      {hasAnalyzableInput ? (
        <p
          data-testid="analysis-status"
          className="rounded-md border border-ink/10 bg-white/82 px-3 py-2 text-sm text-graphite"
        >
          {analysis.status === "loading"
            ? "Запрашиваем LLM-анализ через сервер..."
            : analysis.status === "llm" && analysis.errors.length === 0
              ? textPreprocessing
                ? "LLM-резюме текста применено через /api/analyze."
                : "LLM-анализ применен через /api/analyze."
              : analysis.status === "llm"
                ? "Часть LLM-анализа применена, остальное показано локально."
                : "Показан локальный анализ; LLM-ответ недоступен или еще не получен."}
        </p>
      ) : null}
      {llmWasNotUsed ? (
        <div
          data-testid="llm-fallback-warning"
          role="alert"
          className="rounded-md border border-saffron/45 bg-[#fff7e8] px-3 py-2 text-sm leading-6 text-ink"
        >
          <span className="font-semibold">Внимание: LLM сейчас не использован.</span>{" "}
          Показан локальный детерминированный анализ, потому что серверный LLM-ответ недоступен или не прошел проверку.
        </div>
      ) : null}
    </div>
  );
}

function bestDataset(datasets: SheetDatasetProfile[]) {
  return [...datasets].sort((left, right) => {
    const leftScore = left.rowCount * Math.max(left.columnCount, 1);
    const rightScore = right.rowCount * Math.max(right.columnCount, 1);

    return rightScore - leftScore;
  })[0];
}
