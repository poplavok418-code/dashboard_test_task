import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SUPPORTED_EXTENSIONS = new Set([".csv", ".tsv", ".xlsx", ".xls", ".ods"]);
const DELIMITERS = [",", ";", "\t", "|"];

function parseCsvLine(line, delimiter) {
  const cells = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell.trim());
  return cells;
}

function parseDelimited(text, delimiter) {
  return text
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => parseCsvLine(line, delimiter));
}

function scoreDelimiter(text, delimiter) {
  const rows = parseDelimited(text, delimiter).slice(0, 20);
  const widths = rows.map((row) => row.length);
  const maxWidth = Math.max(...widths, 0);
  const consistentRows = widths.filter((width) => width === maxWidth).length;

  return maxWidth * 100 + consistentRows * 10 + rows.length;
}

function detectDelimiter(text, extension) {
  if (extension === ".tsv") {
    return "\t";
  }

  return DELIMITERS.map((delimiter) => ({
    delimiter,
    score: scoreDelimiter(text, delimiter),
  })).sort((left, right) => right.score - left.score)[0].delimiter;
}

function loadXlsx() {
  try {
    return require("xlsx");
  } catch {
    return require("../../02_input_preprocessing/node_modules/xlsx");
  }
}

function firstNonEmptySheet(workbook, xlsx) {
  for (const sheetName of workbook.SheetNames) {
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: "",
    });

    if (rows.some((row) => row.some((cell) => String(cell ?? "").trim().length > 0))) {
      return {
        sheetName,
        rows,
      };
    }
  }

  return undefined;
}

export async function parseSheetFile(inputPath) {
  if (!existsSync(inputPath)) {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }

  const extension = path.extname(inputPath).toLowerCase();
  const sourceName = path.basename(inputPath);

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported sheet extension: ${extension || "(none)"}`);
  }

  if (extension === ".csv" || extension === ".tsv") {
    const text = await readFile(inputPath, "utf8");
    const delimiter = detectDelimiter(text, extension);
    const rows = parseDelimited(text, delimiter);

    return {
      sourceName,
      sheetName: undefined,
      extension,
      delimiter: delimiter === "\t" ? "tab" : delimiter,
      rows,
    };
  }

  const xlsx = loadXlsx();
  const workbook = xlsx.readFile(inputPath);
  const selectedSheet = firstNonEmptySheet(workbook, xlsx);

  if (!selectedSheet) {
    throw new Error("Workbook does not contain a non-empty sheet.");
  }

  return {
    sourceName,
    sheetName: selectedSheet.sheetName,
    extension,
    delimiter: undefined,
    rows: selectedSheet.rows,
  };
}
