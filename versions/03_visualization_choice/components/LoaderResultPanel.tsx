import { BarChart3 } from "lucide-react";
import type { LoaderResult } from "@/lib/accepted-inputs";
import { selectVisualization } from "@/lib/select-visualization";

type LoaderResultPanelProps = {
  result: LoaderResult | null;
};

export function LoaderResultPanel({ result }: LoaderResultPanelProps) {
  if (!result || result.status !== "accepted") {
    return null;
  }

  const decision = selectVisualization(result.preprocessing);

  return (
    <section
      data-testid="loader-result"
      className="rounded-lg border border-pine/30 bg-[#eef8f3] p-5 shadow-sm"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-pine text-white">
            <BarChart3 aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-pine">
              Решение по визуализации
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{decision.title}</h2>
            <p className="mt-1 text-sm leading-6 text-graphite">{decision.description}</p>
          </div>
        </div>
        <span
          data-testid="visualization-type"
          className="inline-flex items-center rounded-md bg-white/78 px-3 py-2 font-mono text-sm font-semibold text-pine ring-1 ring-pine/18"
        >
          {decision.type}
        </span>
      </div>

      {decision.columns.length > 0 ? (
        <p className="mt-4 text-sm text-graphite">
          Колонки: <span className="font-medium text-ink">{decision.columns.join(", ")}</span>
        </p>
      ) : null}
    </section>
  );
}
