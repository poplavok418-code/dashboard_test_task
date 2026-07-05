import {
  BASIC_LOADER_LIMITS,
  type LoaderResult,
  type ValidationCheck,
} from "./accepted-inputs";
import { preprocessText } from "./preprocess-text";

function countWords(text: string) {
  const matches = text.trim().match(/[^\s]+/gu);
  return matches?.length ?? 0;
}

function countLines(text: string) {
  if (text.length === 0) {
    return 0;
  }

  return text.split(/\r\n|\r|\n/).length;
}

export function validateTextInput(text: string): LoaderResult {
  const trimmedText = text.trim();
  const checks: ValidationCheck[] = [
    {
      id: "not_empty",
      ok: trimmedText.length > 0,
      label: "Текст не пустой",
      detail: trimmedText.length > 0 ? "Есть содержимое для проверки." : "Поле пустое.",
    },
    {
      id: "size_within_limit",
      ok: text.length <= BASIC_LOADER_LIMITS.maxTextChars,
      label: "Размер в пределах лимита",
      detail: `${text.length.toLocaleString("ru-RU")} из ${BASIC_LOADER_LIMITS.maxTextChars.toLocaleString("ru-RU")} символов.`,
    },
  ];

  if (trimmedText.length === 0) {
    return {
      status: "rejected",
      source: "pasted_text",
      checks,
      error: {
        code: "empty_input",
        message: "Текстовое поле пустое.",
        suggestion: "Вставьте текст отчета или загрузите файл с данными.",
      },
    };
  }

  if (text.length > BASIC_LOADER_LIMITS.maxTextChars) {
    return {
      status: "rejected",
      source: "pasted_text",
      checks,
      error: {
        code: "file_too_large",
        message: "Текст слишком большой для базовой проверки.",
        suggestion: `Сократите текст до ${BASIC_LOADER_LIMITS.maxTextChars.toLocaleString("ru-RU")} символов или загрузите меньший фрагмент.`,
      },
    };
  }

  return {
    status: "accepted",
    source: "pasted_text",
    inputKind: "text",
    text: {
      charCount: text.length,
      wordCountApprox: countWords(text),
      lineCount: countLines(text),
    },
    checks: [
      ...checks,
      {
        id: "preprocessing_complete",
        ok: true,
        label: "Предобработка выполнена",
        detail: "Текст нормализован и подготовлен для следующего шага.",
      },
    ],
    preprocessing: preprocessText(text, "вставленный текст"),
  };
}
