export type DataWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type ColumnProfile = {
  name: string;
  inferredType: "number" | "date" | "category" | "text" | "boolean" | "mixed";
  nonEmptyCount: number;
  missingCount: number;
  uniqueCount?: number;
  examples: string[];
  flags: Array<"id_like" | "high_cardinality" | "mostly_missing" | "pii_like">;
};

export type SheetDatasetProfile = {
  id: string;
  sourceName: string;
  sheetName?: string;
  rowCount: number;
  columnCount: number;
  previewRows: Record<string, unknown>[];
  columns: ColumnProfile[];
  warnings: DataWarning[];
  delimiter?: string;
};

export type SheetPreprocessingResult = {
  kind: "sheets";
  datasets: SheetDatasetProfile[];
  warnings: DataWarning[];
};

export type TextChunk = {
  id: string;
  index: number;
  startChar: number;
  endChar: number;
  text: string;
  charCount: number;
};

export type TextPreprocessingResult = {
  kind: "text";
  stats: {
    charCount: number;
    wordCountApprox: number;
    lineCount: number;
    paragraphCount: number;
  };
  chunks: TextChunk[];
  warnings: DataWarning[];
};

export type PreprocessingResult = SheetPreprocessingResult | TextPreprocessingResult;
