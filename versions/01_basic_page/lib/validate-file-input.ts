import {
  acceptedFormatsLabel,
  BASIC_LOADER_LIMITS,
  classifyExtension,
  getFileExtension,
  shouldReadTextSample,
  type LoaderResult,
  type ValidationCheck,
} from "./accepted-inputs";
import { formatFileSize } from "./format-file-size";
import { readFileSample } from "./read-file-sample";

function makeBaseChecks(fileCount: number): ValidationCheck[] {
  return [
    {
      id: "single_input_only",
      ok: fileCount === BASIC_LOADER_LIMITS.maxFilesPerInput,
      label: "Выбран один файл",
      detail:
        fileCount === BASIC_LOADER_LIMITS.maxFilesPerInput
          ? "Можно продолжать проверку."
          : `Получено файлов: ${fileCount}.`,
    },
  ];
}

function fileMetadata(file: File, extension: string) {
  return {
    name: file.name,
    extension,
    mimeType: file.type || "не указан",
    sizeBytes: file.size,
    sizeLabel: formatFileSize(file.size),
    lastModified: file.lastModified,
  };
}

export async function validateFileInput(files: File[]): Promise<LoaderResult> {
  const checks = makeBaseChecks(files.length);

  if (files.length !== BASIC_LOADER_LIMITS.maxFilesPerInput) {
    return {
      status: "rejected",
      source: "file",
      checks,
      error: {
        code: "multiple_files",
        message: "Загрузите только один файл.",
        suggestion: "Выберите один отчет или одну таблицу и повторите загрузку.",
      },
    };
  }

  const [file] = files;
  const extension = getFileExtension(file.name);
  const inputKind = classifyExtension(extension);
  const metadata = fileMetadata(file, extension || "без расширения");

  checks.push(
    {
      id: "extension_supported",
      ok: Boolean(inputKind),
      label: "Формат поддерживается",
      detail: extension || "Расширение не найдено.",
    },
    {
      id: "mime_hint_checked",
      ok: true,
      label: "MIME-подсказка проверена",
      detail: file.type || "Браузер не передал MIME, используем расширение файла.",
    },
    {
      id: "not_empty",
      ok: file.size > 0,
      label: "Файл не пустой",
      detail: file.size > 0 ? metadata.sizeLabel : "Размер файла 0 Б.",
    },
    {
      id: "size_within_limit",
      ok: file.size <= BASIC_LOADER_LIMITS.maxFileSizeBytes,
      label: "Размер в пределах лимита",
      detail: `${metadata.sizeLabel} из ${formatFileSize(BASIC_LOADER_LIMITS.maxFileSizeBytes)}.`,
    },
  );

  if (!inputKind) {
    return {
      status: "rejected",
      source: "file",
      file: metadata,
      checks,
      error: {
        code: "unsupported_type",
        message: "Этот тип файла пока не поддерживается.",
        suggestion: `Загрузите файл одного из форматов: ${acceptedFormatsLabel}.`,
      },
    };
  }

  if (file.size === 0) {
    return {
      status: "rejected",
      source: "file",
      file: metadata,
      checks,
      error: {
        code: "empty_input",
        message: "Файл пустой.",
        suggestion: "Экспортируйте отчет заново или выберите файл с данными.",
      },
    };
  }

  if (file.size > BASIC_LOADER_LIMITS.maxFileSizeBytes) {
    return {
      status: "rejected",
      source: "file",
      file: metadata,
      checks,
      error: {
        code: "file_too_large",
        message: "Файл слишком большой для базовой проверки.",
        suggestion: `Используйте файл до ${formatFileSize(BASIC_LOADER_LIMITS.maxFileSizeBytes)} или сделайте меньший экспорт.`,
      },
    };
  }

  if (shouldReadTextSample(extension)) {
    try {
      const sample = await readFileSample(file);
      const readable = sample.trim().length > 0;

      checks.push({
        id: "sample_readable",
        ok: readable,
        label: "Фрагмент файла читается",
        detail: readable
          ? "Первые строки доступны для дальнейшей обработки."
          : "В начале файла не найдено текста.",
      });

      if (!readable) {
        return {
          status: "rejected",
          source: "file",
          file: metadata,
          checks,
          error: {
            code: "empty_input",
            message: "Файл выглядит пустым.",
            suggestion: "Проверьте экспорт и загрузите файл с заполненными строками.",
          },
        };
      }
    } catch {
      checks.push({
        id: "sample_readable",
        ok: false,
        label: "Фрагмент файла читается",
        detail: "Браузер не смог прочитать файл.",
      });

      return {
        status: "rejected",
        source: "file",
        file: metadata,
        checks,
        error: {
          code: "read_failed",
          message: "Не удалось прочитать файл.",
          suggestion: "Проверьте, что файл не поврежден, и попробуйте еще раз.",
        },
      };
    }
  }

  return {
    status: "accepted",
    source: "file",
    inputKind,
    file: metadata,
    checks,
  };
}
