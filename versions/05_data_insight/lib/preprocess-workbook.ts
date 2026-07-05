import * as XLSX from "xlsx";
import type { DataWarning, SheetPreprocessingResult } from "./input-preprocessing-types";
import { profileTable } from "./profile-table";

export async function preprocessWorkbook(file: File): Promise<SheetPreprocessingResult> {
  const warnings: DataWarning[] = [];

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: false,
      cellFormula: false,
    });
    const hiddenByName = new Set(
      workbook.Workbook?.Sheets?.filter((sheet) => sheet.Hidden).map((sheet) => sheet.name) ?? [],
    );
    const datasets = workbook.SheetNames.flatMap((sheetName) => {
      if (hiddenByName.has(sheetName)) {
        warnings.push({
          code: "hidden_sheet_skipped",
          severity: "info",
          message: `Скрытый лист "${sheetName}" пропущен.`,
        });
        return [];
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: "",
        raw: false,
      });
      const dataset = profileTable(rows, {
        sourceName: file.name,
        sheetName,
      });

      if (!dataset) {
        warnings.push({
          code: "empty_sheet_skipped",
          severity: "info",
          message: `Пустой лист "${sheetName}" пропущен.`,
        });
        return [];
      }

      return [dataset];
    });

    if (datasets.length === 0) {
      warnings.push({
        code: "no_workbook_tables",
        severity: "warning",
        message: "В книге не найдено непустых листов с таблицами.",
      });
    }

    return {
      kind: "sheets",
      datasets,
      warnings,
    };
  } catch {
    return {
      kind: "sheets",
      datasets: [],
      warnings: [
        {
          code: "workbook_parse_failed",
          severity: "error",
          message: "Книгу не удалось разобрать. Возможно, файл поврежден или защищен паролем.",
        },
      ],
    };
  }
}
