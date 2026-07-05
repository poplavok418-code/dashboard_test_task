import type { ColumnProfile, DataWarning, SheetDatasetProfile } from "./input-preprocessing-types";

const MISSING_VALUES = new Set(["", "n/a", "na", "null", "none", "-", "—"]);

function sanitizeCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function isMissing(value: string) {
  return MISSING_VALUES.has(value.toLowerCase());
}

function parseLocaleNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const accountingNegative = /^\(.+\)$/.test(trimmed);
  const cleaned = trimmed
    .replace(/[₽$€£¥]|руб\.?|eur|usd|rur/giu, "")
    .replace(/%$/u, "")
    .replace(/[()]/g, "")
    .replace(/\s/g, "");

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && hasDot) {
    const decimalSeparator = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = cleaned.split(thousandsSeparator).join("");
    normalized = normalized.replace(decimalSeparator, ".");
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  }

  if (!/^-?\d+(\.\d+)?$/u.test(normalized)) {
    return undefined;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return accountingNegative ? -parsed : parsed;
}

function isDateLike(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/u.test(value)) {
    return !Number.isNaN(Date.parse(value));
  }

  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/u.test(value)) {
    const [day, month, year] = value.split(".").map(Number);
    return day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900;
  }

  return false;
}

function isBooleanLike(value: string) {
  return /^(true|false|yes|no|да|нет|1|0)$/iu.test(value);
}

function isPiiLike(value: string) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu.test(value) || /\+?\d[\d\s().-]{8,}\d/u.test(value);
}

function inferColumnType(values: string[]) {
  if (values.length === 0) {
    return "mixed" satisfies ColumnProfile["inferredType"];
  }

  const numericCount = values.filter((value) => parseLocaleNumber(value) !== undefined).length;
  const dateCount = values.filter(isDateLike).length;
  const booleanCount = values.filter(isBooleanLike).length;
  const numericRatio = numericCount / values.length;
  const dateRatio = dateCount / values.length;
  const booleanRatio = booleanCount / values.length;
  const uniqueCount = new Set(values.map((value) => value.toLowerCase())).size;

  if (dateRatio >= 0.7) {
    return "date";
  }

  if (numericRatio >= 0.7) {
    return "number";
  }

  if (booleanRatio >= 0.7) {
    return "boolean";
  }

  if (uniqueCount <= 50 || uniqueCount / values.length <= 0.5) {
    return "category";
  }

  if (Math.max(numericRatio, dateRatio, booleanRatio) >= 0.25) {
    return "mixed";
  }

  return "text";
}

function makeUniqueHeaders(headers: string[]) {
  const counts = new Map<string, number>();

  return headers.map((header, index) => {
    const trimmed = header.trim();
    const baseName = trimmed.length > 0 ? trimmed : `Column ${index + 1}`;
    const seenCount = counts.get(baseName) ?? 0;
    counts.set(baseName, seenCount + 1);

    return seenCount === 0 ? baseName : `${baseName} ${seenCount + 1}`;
  });
}

function removeEmptyColumns(rows: string[][]) {
  const maxColumns = Math.max(...rows.map((row) => row.length), 0);
  const keepColumnIndexes: number[] = [];

  for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
    const hasData = rows.some((row) => !isMissing(sanitizeCell(row[columnIndex])));

    if (hasData) {
      keepColumnIndexes.push(columnIndex);
    }
  }

  return rows.map((row) => keepColumnIndexes.map((columnIndex) => sanitizeCell(row[columnIndex])));
}

export function profileTable(
  rawRows: unknown[][],
  options: {
    sourceName: string;
    sheetName?: string;
    delimiter?: string;
    parserWarnings?: DataWarning[];
  },
): SheetDatasetProfile | undefined {
  const warnings: DataWarning[] = [...(options.parserWarnings ?? [])];
  const normalizedRows = rawRows
    .map((row) => row.map(sanitizeCell))
    .filter((row) => row.some((cell) => !isMissing(cell)));

  if (normalizedRows.length === 0) {
    return undefined;
  }

  const compactRows = removeEmptyColumns(normalizedRows);
  const [headerRow, ...dataRows] = compactRows;
  const headers = makeUniqueHeaders(headerRow);
  const rowObjects = dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, sanitizeCell(row[index])])),
  );

  const columns = headers.map((header, columnIndex): ColumnProfile => {
    const values = dataRows.map((row) => sanitizeCell(row[columnIndex]));
    const nonEmptyValues = values.filter((value) => !isMissing(value));
    const uniqueValues = new Set(nonEmptyValues.map((value) => value.toLowerCase()));
    const examples = Array.from(
      new Map(nonEmptyValues.map((value) => [value.toLowerCase(), value] as const)).values(),
    ).slice(0, 3);
    const missingCount = values.length - nonEmptyValues.length;
    const flags: ColumnProfile["flags"] = [];
    const lowerHeader = header.toLowerCase();
    const allIntegerLike = nonEmptyValues.every((value) => {
      const parsed = parseLocaleNumber(value);
      return parsed !== undefined && Number.isInteger(parsed);
    });

    if (values.length > 0 && missingCount / values.length >= 0.5) {
      flags.push("mostly_missing");
    }

    if (uniqueValues.size > 50 || (nonEmptyValues.length >= 20 && uniqueValues.size / nonEmptyValues.length > 0.8)) {
      flags.push("high_cardinality");
    }

    if (
      /(^|[_\s-])(id|код|номер|invoice|user|customer)([_\s-]|$)/iu.test(lowerHeader) ||
      (nonEmptyValues.length >= 10 && allIntegerLike && uniqueValues.size / nonEmptyValues.length > 0.9)
    ) {
      flags.push("id_like");
    }

    if (/email|phone|телефон|почта/iu.test(lowerHeader) || nonEmptyValues.some(isPiiLike)) {
      flags.push("pii_like");
    }

    return {
      name: header,
      inferredType: inferColumnType(nonEmptyValues),
      nonEmptyCount: nonEmptyValues.length,
      missingCount,
      uniqueCount: uniqueValues.size,
      examples,
      flags,
    };
  });

  if (columns.some((column) => column.flags.includes("mostly_missing"))) {
    warnings.push({
      code: "mostly_missing_columns",
      severity: "warning",
      message: "В таблице есть колонки с большим количеством пропусков.",
    });
  }

  return {
    id: [options.sourceName, options.sheetName ?? "table"].join("::"),
    sourceName: options.sourceName,
    sheetName: options.sheetName,
    rowCount: rowObjects.length,
    columnCount: headers.length,
    rows: rowObjects,
    previewRows: rowObjects.slice(0, 200),
    columns,
    warnings,
    delimiter: options.delimiter,
  };
}
