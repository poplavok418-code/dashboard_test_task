import { AlertTriangle, Braces, FileSpreadsheet, Scissors, TextQuote } from "lucide-react";
import type {
  ColumnProfile,
  DataWarning,
  PreprocessingResult,
  SheetPreprocessingResult,
  TextPreprocessingResult,
} from "@/lib/input-preprocessing-types";

type PreprocessingSummaryProps = {
  preprocessing?: PreprocessingResult;
};

function formatNumber(value: number) {
  return value.toLocaleString("ru-RU");
}

function allWarnings(preprocessing: PreprocessingResult) {
  if (preprocessing.kind === "text") {
    return preprocessing.warnings;
  }

  return [
    ...preprocessing.warnings,
    ...preprocessing.datasets.flatMap((dataset) => dataset.warnings),
  ];
}

function WarningList({ warnings }: { warnings: DataWarning[] }) {
  return (
    <div
      data-testid="data-warning-list"
      className="rounded-md border border-ink/10 bg-white/78 p-3 text-sm text-graphite"
    >
      <div className="flex items-center gap-2 font-semibold text-ink">
        <AlertTriangle aria-hidden="true" className="h-4 w-4 text-saffron" />
        Предупреждения
      </div>
      {warnings.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {warnings.map((warning, index) => (
            <li key={`${warning.code}-${index}`}>
              {warning.message} <span className="text-graphite/70">({warning.code})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2">Предупреждений нет.</p>
      )}
    </div>
  );
}

function ColumnBadge({ column }: { column: ColumnProfile }) {
  return (
    <div className="rounded-md border border-ink/10 bg-white p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">{column.name}</span>
        <span className="rounded bg-sky/10 px-2 py-0.5 text-xs font-semibold text-sky">
          {column.inferredType}
        </span>
      </div>
      <p className="mt-1 text-xs text-graphite">
        заполнено: {formatNumber(column.nonEmptyCount)}, пропусков: {formatNumber(column.missingCount)}
      </p>
      {column.examples.length > 0 ? (
        <p className="mt-1 text-xs text-graphite">примеры: {column.examples.join(", ")}</p>
      ) : null}
      {column.flags.length > 0 ? (
        <p className="mt-1 text-xs font-medium text-saffron">{column.flags.join(", ")}</p>
      ) : null}
    </div>
  );
}

function SheetSummary({ preprocessing }: { preprocessing: SheetPreprocessingResult }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2 text-sm text-graphite">
        <span className="rounded-md bg-white/78 px-3 py-2 ring-1 ring-ink/8">
          Наборов данных: {formatNumber(preprocessing.datasets.length)}
        </span>
        <span className="rounded-md bg-white/78 px-3 py-2 ring-1 ring-ink/8">
          Табличная предобработка
        </span>
      </div>

      <div data-testid="sheet-profile-list" className="grid gap-3">
        {preprocessing.datasets.length > 0 ? (
          preprocessing.datasets.map((dataset) => (
            <article key={dataset.id} className="rounded-md border border-ink/10 bg-white/72 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-sky">
                    {dataset.sheetName ? `${dataset.sourceName} / ${dataset.sheetName}` : dataset.sourceName}
                  </h3>
                  <p className="mt-1 text-sm text-graphite">
                    {formatNumber(dataset.rowCount)} строки, {formatNumber(dataset.columnCount)} колонок
                    {dataset.delimiter ? `, разделитель: ${dataset.delimiter}` : ""}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-pine/10 px-2 py-1 text-xs font-semibold text-pine">
                  <FileSpreadsheet aria-hidden="true" className="h-3.5 w-3.5" />
                  dataset
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {dataset.columns.map((column) => (
                  <ColumnBadge key={column.name} column={column} />
                ))}
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-md border border-ink/10 bg-white/72 p-4 text-sm text-graphite">
            Полезные таблицы не найдены.
          </p>
        )}
      </div>
    </div>
  );
}

function TextSummary({ preprocessing }: { preprocessing: TextPreprocessingResult }) {
  return (
    <div className="grid gap-3">
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md bg-white/78 p-3 ring-1 ring-ink/8">
          <dt className="text-xs uppercase text-graphite">Символов</dt>
          <dd className="font-semibold text-ink">{formatNumber(preprocessing.stats.charCount)}</dd>
        </div>
        <div className="rounded-md bg-white/78 p-3 ring-1 ring-ink/8">
          <dt className="text-xs uppercase text-graphite">Слов примерно</dt>
          <dd className="font-semibold text-ink">{formatNumber(preprocessing.stats.wordCountApprox)}</dd>
        </div>
        <div className="rounded-md bg-white/78 p-3 ring-1 ring-ink/8">
          <dt className="text-xs uppercase text-graphite">Строк</dt>
          <dd className="font-semibold text-ink">{formatNumber(preprocessing.stats.lineCount)}</dd>
        </div>
        <div className="rounded-md bg-white/78 p-3 ring-1 ring-ink/8">
          <dt className="text-xs uppercase text-graphite">Абзацев</dt>
          <dd className="font-semibold text-ink">{formatNumber(preprocessing.stats.paragraphCount)}</dd>
        </div>
      </dl>

      <div data-testid="text-chunk-list" className="rounded-md border border-ink/10 bg-white/72 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <Scissors aria-hidden="true" className="h-4 w-4 text-saffron" />
            {formatNumber(preprocessing.chunks.length)} фрагмент, каждый до 10 000 символов
          </div>
          <span className="rounded-md bg-sky/10 px-2 py-1 text-xs font-semibold text-sky">
            overlap до 500 символов
          </span>
        </div>

        {preprocessing.chunks.length > 0 ? (
          <ul className="mt-3 grid gap-2">
            {preprocessing.chunks.slice(0, 4).map((chunk) => (
              <li key={chunk.id} className="rounded-md bg-white p-3 text-sm text-graphite ring-1 ring-ink/8">
                <span className="font-semibold text-ink">
                  Фрагмент {chunk.index + 1}: {formatNumber(chunk.charCount)} символов.
                </span>{" "}
                {chunk.text.slice(0, 140)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-graphite">Текстовые фрагменты недоступны для этого формата.</p>
        )}
      </div>
    </div>
  );
}

export function PreprocessingSummary({ preprocessing }: PreprocessingSummaryProps) {
  if (!preprocessing) {
    return null;
  }

  const warnings = allWarnings(preprocessing);

  return (
    <section
      data-testid="preprocessing-summary"
      className="mt-5 rounded-lg border border-sky/18 bg-[#f4fbff] p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky">
            {preprocessing.kind === "sheets" ? (
              <Braces aria-hidden="true" className="h-4 w-4" />
            ) : (
              <TextQuote aria-hidden="true" className="h-4 w-4" />
            )}
            Предобработка данных
          </div>
          <h2 className="mt-1 text-lg font-semibold text-sky">
            {preprocessing.kind === "sheets"
              ? "Таблица подготовлена к профилированию"
              : "Текст подготовлен и разделен на фрагменты"}
          </h2>
        </div>
      </div>

      {preprocessing.kind === "sheets" ? (
        <SheetSummary preprocessing={preprocessing} />
      ) : (
        <TextSummary preprocessing={preprocessing} />
      )}

      <div className="mt-4">
        <WarningList warnings={warnings} />
      </div>
    </section>
  );
}
