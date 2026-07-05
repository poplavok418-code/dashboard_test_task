"use client";

import { useCallback, useId, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  FileUp,
  Loader2,
  MousePointerClick,
  RotateCcw,
  ShieldCheck,
  TextCursorInput,
} from "lucide-react";
import { acceptedFormatsLabel, BASIC_LOADER_LIMITS, type LoaderResult } from "@/lib/accepted-inputs";
import { formatFileSize } from "@/lib/format-file-size";
import { validateFileInput } from "@/lib/validate-file-input";
import { validateTextInput } from "@/lib/validate-text-input";
import { LoaderErrorState } from "./LoaderErrorState";
import { LoaderResultPanel } from "./LoaderResultPanel";

export function DataInputPanel() {
  const [result, setResult] = useState<LoaderResult | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [textValue, setTextValue] = useState("");
  const inputId = useId();

  const processFiles = useCallback(async (files: File[]) => {
    setIsReading(true);
    setResult({
      status: "reading",
      source: "file",
      checks: [],
    });

    try {
      const nextResult = await validateFileInput(files);
      setResult(nextResult);
    } finally {
      setIsReading(false);
    }
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      void processFiles(acceptedFiles);
    },
    [processFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noKeyboard: true,
    multiple: true,
  });

  const handleTextChange = (value: string) => {
    setTextValue(value);

    if (value.length === 0) {
      setResult(null);
      return;
    }

    setResult(validateTextInput(value));
  };

  const resetLoader = () => {
    setTextValue("");
    setResult(null);
    setIsReading(false);
  };

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-ink/10 bg-panel p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-saffron">
              Готово к проверке
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">
              Перетащите файл или вставьте текст
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite">
              Поддерживаются таблицы и текстовые отчеты. Сырые файлы остаются в браузере и не
              отправляются на сервер.
            </p>
          </div>

          <button
            type="button"
            onClick={resetLoader}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-ink/12 bg-white px-3 text-sm font-medium text-ink transition hover:border-saffron hover:text-saffron focus:outline-none focus:ring-2 focus:ring-saffron/45"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Очистить
          </button>
        </div>

        <div
          {...getRootProps({
            "data-testid": "file-dropzone",
            className: [
              "group mt-5 flex min-h-[30rem] cursor-pointer flex-col rounded-lg border-2 border-dashed p-5 transition focus:outline-none focus:ring-2 focus:ring-saffron/45",
              isDragActive
                ? "border-saffron bg-[#fff7e8]"
                : "border-ink/18 bg-white/70 hover:border-saffron hover:bg-[#fffaf0]",
              isReading ? "pointer-events-none opacity-78" : "",
            ].join(" "),
          })}
        >
          <input
            {...getInputProps({
              id: inputId,
              "data-testid": "file-input",
            })}
          />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex max-w-3xl gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-sky text-white shadow-sm">
                {isReading ? (
                  <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" />
                ) : (
                  <FileUp aria-hidden="true" className="h-6 w-6" />
                )}
              </span>
              <div>
                <h2 className="text-xl font-semibold text-ink">
                  {isDragActive ? "Отпустите файл здесь" : "Файл или текст в одном окне"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-graphite">
                  Перетащите файл прямо сюда, нажмите на свободную область для выбора файла или
                  вставьте текст в большое поле ниже.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-white/82 px-3 py-2 text-sm font-semibold text-ink ring-1 ring-ink/8">
                {formatFileSize(BASIC_LOADER_LIMITS.maxFileSizeBytes)}
              </span>
              <span className="rounded-md bg-white/82 px-3 py-2 text-sm font-semibold text-ink ring-1 ring-ink/8">
                {acceptedFormatsLabel}
              </span>
            </div>
          </div>

          <label
            htmlFor="paste-text-input"
            className="mt-5 flex items-center gap-2 text-base font-semibold text-ink"
          >
            <TextCursorInput aria-hidden="true" className="h-5 w-5 text-saffron" />
            Вставьте или напишите текст
          </label>
          <textarea
            id="paste-text-input"
            data-testid="paste-text-input"
            value={textValue}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => handleTextChange(event.target.value)}
            placeholder="Вставьте текст отчета сюда или перетащите файл в это окно..."
            className="mt-3 min-h-64 flex-1 resize-none rounded-md border border-ink/12 bg-white/82 p-4 text-sm leading-6 text-ink outline-none transition placeholder:text-graphite/60 focus:border-saffron focus:ring-2 focus:ring-saffron/30"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-graphite">
            <span>{textValue.length.toLocaleString("ru-RU")} символов</span>
            <span className="inline-flex items-center gap-2 text-sky">
              <MousePointerClick aria-hidden="true" className="h-4 w-4" />
              Нажмите вне поля текста для выбора файла
            </span>
            <span className="inline-flex items-center gap-2 text-pine">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              Проверка локально
            </span>
          </div>
        </div>
      </section>

      {result?.status === "reading" ? (
        <section
          className="flex items-center gap-3 rounded-lg border border-sky/20 bg-white/82 p-5 text-sm font-medium text-sky"
          aria-live="polite"
        >
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
          Читаем файл и проверяем метаданные...
        </section>
      ) : null}

      <LoaderResultPanel result={result} />
      <LoaderErrorState result={result} />
    </div>
  );
}
