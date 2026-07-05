import { AlertTriangle } from "lucide-react";
import type { LoaderResult } from "@/lib/accepted-inputs";
import { ValidationChecklist } from "./ValidationChecklist";

type LoaderErrorStateProps = {
  result: LoaderResult | null;
};

export function LoaderErrorState({ result }: LoaderErrorStateProps) {
  if (!result || result.status !== "rejected" || !result.error) {
    return null;
  }

  return (
    <section
      data-testid="loader-error"
      className="rounded-lg border border-berry/28 bg-[#fff2f5] p-5 shadow-sm"
      aria-live="assertive"
    >
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-berry text-white">
          <AlertTriangle aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-ink">Нужен другой ввод</h2>
          <p className="mt-1 text-sm font-medium text-berry">{result.error.message}</p>
          <p className="mt-2 text-sm leading-6 text-graphite">{result.error.suggestion}</p>
          {result.file ? (
            <p className="mt-2 text-sm text-graphite">
              Файл: {result.file.name}, тип: {result.file.extension}, размер:{" "}
              {result.file.sizeLabel}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <ValidationChecklist checks={result.checks} />
      </div>
    </section>
  );
}
