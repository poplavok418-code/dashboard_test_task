import { chunkText, TEXT_CHUNKING_LIMITS } from "./chunk-text";
import type { TextPreprocessingResult } from "./input-preprocessing-types";

function normalizeText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function countWords(text: string) {
  return text.match(/[^\s]+/gu)?.length ?? 0;
}

function countLines(text: string) {
  return text.length === 0 ? 0 : text.split("\n").length;
}

function countParagraphs(text: string) {
  return text
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length;
}

export function preprocessText(text: string, sourceName = "text"): TextPreprocessingResult {
  const normalizedText = normalizeText(text);
  const chunks = normalizedText.length > 0 ? chunkText(normalizedText) : [];
  const warnings: TextPreprocessingResult["warnings"] = [];

  if (normalizedText.length > TEXT_CHUNKING_LIMITS.maxCharsPerChunk) {
    warnings.push({
      code: "long_text_chunked",
      severity: "info",
      message: `Текст длинный, поэтому он разделен на ${chunks.length} фрагментов для анализа.`,
    });
  }

  if (text !== normalizedText) {
    warnings.push({
      code: "text_normalized",
      severity: "info",
      message: `Текст ${sourceName} нормализован: очищены переносы строк, управляющие символы и лишние отступы.`,
    });
  }

  return {
    kind: "text",
    stats: {
      charCount: normalizedText.length,
      wordCountApprox: countWords(normalizedText),
      lineCount: countLines(normalizedText),
      paragraphCount: countParagraphs(normalizedText),
    },
    chunks,
    warnings,
  };
}

export function unsupportedDocumentPreprocessing(sourceName: string, extension: string): TextPreprocessingResult {
  return {
    kind: "text",
    stats: {
      charCount: 0,
      wordCountApprox: 0,
      lineCount: 0,
      paragraphCount: 0,
    },
    chunks: [],
    warnings: [
      {
        code: "document_extraction_unsupported",
        severity: "warning",
        message: `Файл ${sourceName} принят, но извлечение текста из ${extension} в этой версии пока не выполняется.`,
      },
    ],
  };
}
