import type { PreprocessingResult } from "./input-preprocessing-types";

export type InputKind = "sheets" | "text";
export type LoaderStatus = "idle" | "reading" | "accepted" | "rejected";

export type ValidationCheck = {
  id:
    | "extension_supported"
    | "mime_hint_checked"
    | "size_within_limit"
    | "not_empty"
    | "single_input_only"
    | "sample_readable"
    | "preprocessing_complete";
  ok: boolean;
  label: string;
  detail?: string;
};

export type LoaderError = {
  code:
    | "unsupported_type"
    | "file_too_large"
    | "empty_input"
    | "multiple_files"
    | "read_failed";
  message: string;
  suggestion: string;
};

export type LoaderResult = {
  status: LoaderStatus;
  source: "file" | "pasted_text";
  inputKind?: InputKind;
  file?: {
    name: string;
    extension: string;
    mimeType: string;
    sizeBytes: number;
    sizeLabel: string;
    lastModified?: number;
  };
  text?: {
    charCount: number;
    wordCountApprox: number;
    lineCount: number;
  };
  checks: ValidationCheck[];
  preprocessing?: PreprocessingResult;
  error?: LoaderError;
};

export const BASIC_LOADER_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxTextChars: 100_000,
  maxFileSampleBytes: 64 * 1024,
  maxFilesPerInput: 1,
} as const;

export const SHEET_EXTENSIONS = [".csv", ".tsv", ".xls", ".xlsx", ".ods"] as const;
export const TEXT_EXTENSIONS = [".txt", ".md", ".log", ".docx", ".doc"] as const;

export const ACCEPTED_EXTENSIONS = [...SHEET_EXTENSIONS, ...TEXT_EXTENSIONS] as const;

const textSampleExtensions = new Set([".csv", ".tsv", ".txt", ".md", ".log"]);
const preprocessableTextExtensions = new Set([".txt", ".md", ".log"]);
const workbookExtensions = new Set([".xls", ".xlsx", ".ods"]);
const delimitedSheetExtensions = new Set([".csv", ".tsv"]);

export function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return "";
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}

export function classifyExtension(extension: string): InputKind | undefined {
  if ((SHEET_EXTENSIONS as readonly string[]).includes(extension)) {
    return "sheets";
  }

  if ((TEXT_EXTENSIONS as readonly string[]).includes(extension)) {
    return "text";
  }

  return undefined;
}

export function shouldReadTextSample(extension: string) {
  return textSampleExtensions.has(extension);
}

export function shouldPreprocessTextFile(extension: string) {
  return preprocessableTextExtensions.has(extension);
}

export function shouldPreprocessDelimitedSheet(extension: string) {
  return delimitedSheetExtensions.has(extension);
}

export function shouldPreprocessWorkbook(extension: string) {
  return workbookExtensions.has(extension);
}

export const acceptedFormatsLabel = ACCEPTED_EXTENSIONS.join(", ");
