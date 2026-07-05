"use client";

import { Loader2, Sparkles } from "lucide-react";

type NarrativeHeroProps = {
  insight?: string | null;
  status: "idle" | "loading" | "llm" | "fallback";
  errors?: string[];
};

function clampSentences(text: string) {
  const sentences = text
    .match(/[^.!?…]+[.!?…]+|[^.!?…]+$/gu)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];

  if (sentences.length <= 3) {
    return text;
  }

  return sentences.slice(0, 3).join(" ");
}

export function NarrativeHero({ insight, status, errors = [] }: NarrativeHeroProps) {
  const cleanInsight = insight?.trim();
  const visibleInsight = cleanInsight
    ? clampSentences(cleanInsight)
    : status === "loading"
      ? "Собираем главный инсайт..."
      : "Данные приняты, но для сильного вывода пока не хватает надежного сигнала.";
  const badge = status === "loading"
    ? "Анализ"
    : status === "llm" && errors.length === 0
      ? "LLM"
      : "Локально";

  return (
    <section
      data-testid="narrative-hero"
      className="overflow-hidden rounded-lg border border-sky/15 bg-[#f8faff] p-5 shadow-soft"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-saffron">AI-нарратив</p>
          <h2 className="mt-2 text-2xl font-semibold text-sky sm:text-3xl">Главный инсайт</h2>
          <p data-testid="narrative-hero-insight" className="mt-3 text-base leading-7 text-ink sm:text-lg">
            {visibleInsight}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-sky ring-1 ring-sky/15">
          {status === "loading" ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" className="h-4 w-4" />
          )}
          {badge}
        </span>
      </div>
    </section>
  );
}
