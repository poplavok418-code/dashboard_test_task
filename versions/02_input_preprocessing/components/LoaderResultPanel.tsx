import { CheckCircle2, FileSpreadsheet, FileText, Type } from "lucide-react";
import type { LoaderResult } from "@/lib/accepted-inputs";
import { PreprocessingSummary } from "./PreprocessingSummary";
import { ValidationChecklist } from "./ValidationChecklist";

type LoaderResultPanelProps = {
  result: LoaderResult | null;
};

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-pine/18 bg-white/72 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-graphite">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function LoaderResultPanel({ result }: LoaderResultPanelProps) {
  if (!result || result.status !== "accepted") {
    return null;
  }

  const SourceIcon = result.source === "file" ? FileText : Type;
  const KindIcon = result.inputKind === "sheets" ? FileSpreadsheet : FileText;

  return (
    <section
      data-testid="loader-result"
      className="rounded-lg border border-pine/30 bg-[#eef8f3] p-5 shadow-sm"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-pine text-white">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {result.source === "file" ? "Файл принят" : "Текст принят"}
            </h2>
            <p className="mt-1 text-sm text-graphite">
              Готово к следующему шагу обработки. Input kind: {result.inputKind}.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md bg-white/78 px-3 py-2 text-sm font-medium text-pine ring-1 ring-pine/18">
          <SourceIcon aria-hidden="true" className="h-4 w-4" />
          accepted
        </span>
      </div>

      {result.file ? (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Имя файла" value={result.file.name} />
          <Field label="Тип файла" value={result.file.extension} />
          <Field label="Размер" value={result.file.sizeLabel} />
          <Field label="Input kind" value={result.inputKind ?? "не определен"} />
        </dl>
      ) : null}

      {result.text ? (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Тип ввода" value="вставленный текст" />
          <Field label="Символов" value={result.text.charCount.toLocaleString("ru-RU")} />
          <Field label="Слов примерно" value={result.text.wordCountApprox.toLocaleString("ru-RU")} />
          <Field label="Строк" value={result.text.lineCount.toLocaleString("ru-RU")} />
          <Field label="Input kind" value={result.inputKind ?? "text"} />
        </dl>
      ) : null}

      <div className="mt-5 flex items-center gap-2 text-sm font-medium text-pine">
        <KindIcon aria-hidden="true" className="h-4 w-4" />
        <span>{result.inputKind === "sheets" ? "Табличные данные" : "Текстовые данные"}</span>
      </div>

      <div className="mt-4">
        <ValidationChecklist checks={result.checks} />
      </div>

      <PreprocessingSummary preprocessing={result.preprocessing} />
    </section>
  );
}
