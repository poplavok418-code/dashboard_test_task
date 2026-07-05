import { Activity, DatabaseZap } from "lucide-react";
import { DataInputPanel } from "@/components/DataInputPanel";

export default function DataLoaderPage() {
  return (
    <main data-testid="data-loader-page" className="min-h-screen">
      <header className="border-b border-ink/10 bg-panel/82 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-white">
              <DatabaseZap aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-5 text-ink">Аналитика данных</p>
              <p className="text-xs text-graphite">Базовый загрузчик</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-md border border-pine/20 bg-white/76 px-3 py-2 text-sm font-medium text-pine">
            <Activity aria-hidden="true" className="h-4 w-4" />
            Клиентская проверка
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <DataInputPanel />
      </div>
    </main>
  );
}
