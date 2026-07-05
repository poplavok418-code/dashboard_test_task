import Papa from "papaparse";
import type { SheetPreprocessingResult } from "./input-preprocessing-types";
import { profileTable } from "./profile-table";

const DELIMITERS = [",", ";", "\t", "|"] as const;

function delimiterLabel(delimiter: string) {
  return delimiter === "\t" ? "tab" : delimiter;
}

function scoreRows(rows: unknown[][]) {
  const nonEmptyRows = rows.filter((row) => row.some((cell) => String(cell ?? "").trim().length > 0));
  const widths = nonEmptyRows.map((row) => row.length);
  const maxWidth = Math.max(...widths, 0);
  const consistentRows = widths.filter((width) => width === maxWidth).length;

  return maxWidth * 100 + consistentRows * 10 + nonEmptyRows.length;
}

function parseWithDelimiter(text: string, delimiter: string) {
  return Papa.parse(text, {
    delimiter,
    skipEmptyLines: false,
  }) as {
    data: unknown[];
    errors: Array<{ message: string; row?: number; code?: string }>;
    meta: { delimiter?: string };
  };
}

function detectDelimiter(text: string, extension: string) {
  if (extension === ".tsv") {
    return "\t";
  }

  let bestDelimiter = ",";
  let bestScore = -1;

  for (const delimiter of DELIMITERS) {
    const parsed = parseWithDelimiter(text, delimiter);
    const rows = parsed.data as unknown[][];
    const score = scoreRows(rows);

    if (score > bestScore) {
      bestDelimiter = delimiter;
      bestScore = score;
    }
  }

  return bestDelimiter;
}

export function preprocessDelimitedTable(
  text: string,
  sourceName: string,
  extension: string,
): SheetPreprocessingResult {
  const delimiter = detectDelimiter(text, extension);
  const parsed = parseWithDelimiter(text, delimiter);
  const rows = parsed.data as unknown[][];
  const parserWarnings = parsed.errors.slice(0, 5).map((error) => ({
    code: "parser_warning",
    severity: "warning" as const,
    message: `Парсер сообщил о проблеме в строке ${error.row ?? "?"}: ${error.message}`,
  }));
  const dataset = profileTable(rows, {
    sourceName,
    delimiter: delimiterLabel(delimiter),
    parserWarnings,
  });

  if (!dataset) {
    return {
      kind: "sheets",
      datasets: [],
      warnings: [
        {
          code: "no_table_detected",
          severity: "warning",
          message: "В файле не удалось найти полезную таблицу.",
        },
      ],
    };
  }

  return {
    kind: "sheets",
    datasets: [dataset],
    warnings: [
      {
        code: "delimiter_detected",
        severity: "info",
        message: `Определен разделитель: ${delimiterLabel(delimiter)}.`,
      },
      ...dataset.warnings,
    ],
  };
}
