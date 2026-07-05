import type { ColumnProfile, SheetDatasetProfile, TextPreprocessingResult } from "./input-preprocessing-types";
import type { SuggestedVisualization } from "./suggested-visualization";

export type InsightCandidate = {
  type: string;
  claim: string;
  evidence: string;
  score: number;
};

export type InsightColumnProfile = ColumnProfile & {
  numericStats?: {
    min: number;
    max: number;
    mean: number;
    median: number;
    sum: number;
  };
  categoryStats?: {
    topValues: Array<{ label: string; count: number; share: number }>;
  };
};

export type SheetInsightContext = {
  sourceType: "sheet";
  fileName: string;
  sheetName?: string;
  rowCount: number;
  columnCount: number;
  columns: InsightColumnProfile[];
  insightCandidates: InsightCandidate[];
  warnings: Array<{ code: string; message: string }>;
  sample: {
    columns: string[];
    rows: string[][];
  };
};

export type TextInsightContext = {
  sourceType: "text";
  sourceName: string;
  charCount: number;
  wordCountApprox: number;
  lineCount: number;
  paragraphCount: number;
  chunks: Array<{
    id: string;
    index: number;
    text: string;
    charCount: number;
  }>;
  warnings: Array<{ code: string; message: string }>;
};

export type InsightContext = SheetInsightContext | TextInsightContext;

export type SheetVisualizationContext = {
  sourceType: "sheet";
  fileName: string;
  sheetName?: string;
  rowCount: number;
  columnCount: number;
  columns: InsightColumnProfile[];
  sample: SheetInsightContext["sample"];
  chartCandidates: Array<{
    id: string;
    type: string;
    x?: string | null;
    y?: string | null;
    category?: string | null;
    series?: string | null;
    value?: string | null;
    aggregation?: string | null;
    reason: string;
  }>;
  warnings: SheetInsightContext["warnings"];
};

export type AnalyzeRequestPayload = {
  locale: "ru";
  insightContext: InsightContext;
  visualizationContext?: SheetVisualizationContext;
};

const MISSING_VALUES = new Set(["", "n/a", "na", "null", "none", "-", "—"]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function isMissing(value: unknown) {
  return MISSING_VALUES.has(clean(value).toLowerCase());
}

function numberFromValue(value: unknown) {
  const raw = clean(value)
    .replace(/[₽$€£¥]|руб\.?|eur|usd|rur/giu, "")
    .replace(/%$/u, "")
    .replace(/[()]/g, "")
    .replace(/\s/g, "");

  if (!raw) {
    return undefined;
  }

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  let normalized = raw;

  if (hasComma && hasDot) {
    const decimalSeparator = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = raw.split(thousandsSeparator).join("").replace(decimalSeparator, ".");
  } else if (hasComma) {
    normalized = raw.replace(",", ".");
  }

  if (!/^-?\d+(\.\d+)?$/u.test(normalized)) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(value);
}

function pluralRu(value: number, one: string, few: string, many: string) {
  const absolute = Math.abs(Math.trunc(value));
  const lastTwo = absolute % 100;
  const last = absolute % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return many;
  }

  if (last === 1) {
    return one;
  }

  if (last >= 2 && last <= 4) {
    return few;
  }

  return many;
}

function formatDatasetShape(rowCount: number, columnCount: number) {
  return `${formatNumber(rowCount)} ${pluralRu(rowCount, "строка", "строки", "строк")} и ${formatNumber(columnCount)} ${pluralRu(columnCount, "колонка", "колонки", "колонок")}`;
}

function numericStats(values: unknown[]) {
  const numbers = values.map(numberFromValue).filter((value): value is number => value !== undefined).sort((a, b) => a - b);

  if (numbers.length === 0) {
    return undefined;
  }

  const sum = numbers.reduce((total, value) => total + value, 0);
  const middle = Math.floor(numbers.length / 2);
  const median = numbers.length % 2 === 0 ? (numbers[middle - 1] + numbers[middle]) / 2 : numbers[middle];

  return {
    min: numbers[0],
    max: numbers[numbers.length - 1],
    mean: sum / numbers.length,
    median,
    sum,
  };
}

function categoryStats(values: unknown[], rowCount: number) {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (!isMissing(value)) {
      const label = clean(value);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  const topValues = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([label, count]) => ({
      label,
      count,
      share: rowCount > 0 ? count / rowCount : 0,
    }));

  return topValues.length > 0 ? { topValues } : undefined;
}

function isUsableNumber(column: InsightColumnProfile) {
  return column.inferredType === "number" && !column.flags.includes("id_like") && !column.flags.includes("mostly_missing");
}

function isUsableCategory(column: InsightColumnProfile) {
  return ["category", "boolean"].includes(column.inferredType) &&
    !column.flags.includes("high_cardinality") &&
    !column.flags.includes("mostly_missing") &&
    (column.uniqueCount ?? 0) >= 2;
}

function isUsableDate(column: InsightColumnProfile) {
  return column.inferredType === "date" && !column.flags.includes("mostly_missing");
}

function columnsWithStats(dataset: SheetDatasetProfile): InsightColumnProfile[] {
  return dataset.columns.map((column) => {
    const values = dataset.rows.map((row) => row[column.name]);

    return {
      ...column,
      numericStats: column.inferredType === "number" ? numericStats(values) : undefined,
      categoryStats: ["category", "boolean"].includes(column.inferredType) ? categoryStats(values, dataset.rowCount) : undefined,
    };
  });
}

function groupedNumericCandidate(
  dataset: SheetDatasetProfile,
  category: InsightColumnProfile,
  number: InsightColumnProfile,
): InsightCandidate | undefined {
  const totals = new Map<string, number>();

  for (const row of dataset.rows) {
    const label = clean(row[category.name]);
    const value = numberFromValue(row[number.name]);

    if (!label || value === undefined) {
      continue;
    }

    totals.set(label, (totals.get(label) ?? 0) + value);
  }

  const [leader] = [...totals.entries()].sort((left, right) => right[1] - left[1]);

  if (!leader) {
    return undefined;
  }

  return {
    type: "group_numeric_leader",
    claim: `${leader[0]} лидирует по сумме ${number.name}.`,
    evidence: `${category.name}=${leader[0]}, ${number.name}=${formatNumber(leader[1])}.`,
    score: 0.94,
  };
}

function buildInsightCandidates(dataset: SheetDatasetProfile, columns: InsightColumnProfile[]) {
  const candidates: InsightCandidate[] = [
    {
      type: "dataset_shape",
      claim: `Таблица содержит ${formatDatasetShape(dataset.rowCount, dataset.columnCount)}.`,
      evidence: formatDatasetShape(dataset.rowCount, dataset.columnCount),
      score: 0.6,
    },
  ];

  const numbers = columns.filter(isUsableNumber);
  const categories = columns.filter(isUsableCategory);

  for (const category of categories.slice(0, 2)) {
    const top = category.categoryStats?.topValues[0];

    if (top) {
      candidates.push({
        type: "category_concentration",
        claim: `Самое частое значение в колонке ${category.name} - ${top.label}.`,
        evidence: `${top.label}: ${formatNumber(top.count)} строк (${Math.round(top.share * 100)}%).`,
        score: 0.8,
      });
    }
  }

  for (const number of numbers.slice(0, 3)) {
    const stats = number.numericStats;

    if (stats) {
      candidates.push({
        type: "numeric_range",
        claim: `Колонка ${number.name} находится в диапазоне от ${formatNumber(stats.min)} до ${formatNumber(stats.max)}.`,
        evidence: `Сумма ${formatNumber(stats.sum)}, среднее ${formatNumber(stats.mean)}, медиана ${formatNumber(stats.median)}.`,
        score: 0.78,
      });
    }
  }

  if (categories[0] && numbers[0]) {
    const grouped = groupedNumericCandidate(dataset, categories[0], numbers[0]);

    if (grouped) {
      candidates.push(grouped);
    }
  }

  for (const warning of dataset.warnings.slice(0, 2)) {
    candidates.push({
      type: "quality_warning",
      claim: warning.message,
      evidence: warning.code,
      score: 0.5,
    });
  }

  return candidates.sort((left, right) => right.score - left.score).slice(0, 8);
}

function candidateId(type: string, ...parts: Array<string | null | undefined>) {
  return [type, ...parts.filter(Boolean)].join("_");
}

function buildChartCandidates(columns: InsightColumnProfile[], selected: SuggestedVisualization) {
  const numbers = columns.filter(isUsableNumber);
  const categories = columns.filter(isUsableCategory);
  const dates = columns.filter(isUsableDate);
  const dimensions = [...categories, ...dates];
  const candidates: SheetVisualizationContext["chartCandidates"] = [];

  for (const date of dates) {
    for (const number of numbers) {
      candidates.push({
        id: candidateId("line_chart", date.name, number.name),
        type: "line_chart",
        x: date.name,
        y: number.name,
        value: number.name,
        aggregation: "sum",
        reason: "Reliable date/time column plus numeric measure.",
      });
    }
  }

  if (numbers.length >= 2) {
    candidates.push({
      id: candidateId("scatter_plot", numbers[0].name, numbers[1].name),
      type: "scatter_plot",
      x: numbers[0].name,
      y: numbers[1].name,
      aggregation: null,
      reason: "Two reliable numeric columns can show relationship or outliers.",
    });
  }

  if (numbers.length >= 1) {
    candidates.push({
      id: candidateId("histogram", numbers[0].name),
      type: "histogram",
      x: numbers[0].name,
      value: numbers[0].name,
      aggregation: "count",
      reason: "One numeric column can show distribution.",
    });
  }

  for (const category of categories) {
    for (const number of numbers) {
      candidates.push({
        id: candidateId("bar_chart", category.name, number.name),
        type: "bar_chart",
        x: category.name,
        y: number.name,
        category: category.name,
        value: number.name,
        aggregation: "sum",
        reason: "Category column plus numeric measure.",
      });

      if ((category.uniqueCount ?? 0) <= 8 && (number.numericStats?.min ?? 0) >= 0) {
        candidates.push({
          id: candidateId("pie_chart", category.name, number.name),
          type: "pie_chart",
          category: category.name,
          value: number.name,
          aggregation: "sum",
          reason: "Small category set with positive numeric values can show part of whole.",
        });
        candidates.push({
          id: candidateId("donut_chart", category.name, number.name),
          type: "donut_chart",
          category: category.name,
          value: number.name,
          aggregation: "sum",
          reason: "Small category set with positive numeric values can show a compact part-of-whole view.",
        });
      }
    }
  }

  if (dimensions.length >= 2 && numbers.length >= 1) {
    candidates.push({
      id: candidateId("heatmap", dimensions[0].name, dimensions[1].name, numbers[0].name),
      type: "heatmap",
      x: dimensions[0].name,
      y: dimensions[1].name,
      value: numbers[0].name,
      aggregation: "sum",
      reason: "Two compact dimensions plus one numeric measure can form a grid.",
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      id: "data_table",
      type: "data_table",
      reason: "No reliable automatic chart candidate found.",
    });
  }

  const selectedCandidate = {
    id: selected.chart_candidate_id ?? candidateId(selected.type, selected.encoding.x, selected.encoding.y, selected.encoding.category, selected.encoding.value),
    type: selected.type,
    x: selected.encoding.x,
    y: selected.encoding.y,
    category: selected.encoding.category,
    series: selected.encoding.series,
    value: selected.encoding.value,
    aggregation: selected.encoding.aggregation,
    reason: selected.description || "Current deterministic browser selection.",
  };

  return [selectedCandidate, ...candidates]
    .filter((candidate, index, all) => all.findIndex((item) => item.id === candidate.id) === index)
    .slice(0, 20);
}

export function buildInsightContext(dataset: SheetDatasetProfile): SheetInsightContext {
  const columns = columnsWithStats(dataset);

  return {
    sourceType: "sheet",
    fileName: dataset.sourceName,
    sheetName: dataset.sheetName,
    rowCount: dataset.rowCount,
    columnCount: dataset.columnCount,
    columns,
    insightCandidates: buildInsightCandidates(dataset, columns),
    warnings: dataset.warnings.map((warning) => ({ code: warning.code, message: warning.message })),
    sample: {
      columns: dataset.columns.map((column) => column.name),
      rows: dataset.previewRows.slice(0, 30).map((row) => dataset.columns.map((column) => clean(row[column.name]))),
    },
  };
}

export function buildTextInsightContext(
  preprocessing: TextPreprocessingResult,
  sourceName = "text",
): TextInsightContext {
  return {
    sourceType: "text",
    sourceName,
    charCount: preprocessing.stats.charCount,
    wordCountApprox: preprocessing.stats.wordCountApprox,
    lineCount: preprocessing.stats.lineCount,
    paragraphCount: preprocessing.stats.paragraphCount,
    chunks: preprocessing.chunks.slice(0, 8).map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      text: chunk.text,
      charCount: chunk.charCount,
    })),
    warnings: preprocessing.warnings.map((warning) => ({ code: warning.code, message: warning.message })),
  };
}

export function buildAnalyzeRequestPayload(
  dataset: SheetDatasetProfile,
  selectedVisualization: SuggestedVisualization,
): AnalyzeRequestPayload {
  const insightContext = buildInsightContext(dataset);

  return {
    locale: "ru",
    insightContext,
    visualizationContext: {
      sourceType: "sheet",
      fileName: dataset.sourceName,
      sheetName: dataset.sheetName,
      rowCount: dataset.rowCount,
      columnCount: dataset.columnCount,
      columns: insightContext.columns,
      sample: insightContext.sample,
      chartCandidates: buildChartCandidates(insightContext.columns, selectedVisualization),
      warnings: insightContext.warnings,
    },
  };
}

export function buildTextAnalyzeRequestPayload(
  preprocessing: TextPreprocessingResult,
  sourceName = "text",
): AnalyzeRequestPayload {
  return {
    locale: "ru",
    insightContext: buildTextInsightContext(preprocessing, sourceName),
  };
}

export function buildLocalInsight(dataset: SheetDatasetProfile | undefined) {
  if (!dataset) {
    return "В загруженном файле не найден надежный табличный набор данных. Поэтому сейчас можно показать только осторожный обзор без сильных выводов. Для более точного инсайта нужен файл с заголовками и несколькими заполненными строками. Если данные текстовые, лучше обработать их отдельным текстовым агентом. График ниже стоит читать как технический fallback.";
  }

  const context = buildInsightContext(dataset);
  const candidates = context.insightCandidates;
  const shape = candidates.find((candidate) => candidate.type === "dataset_shape");
  const groupLeader = candidates.find((candidate) => candidate.type === "group_numeric_leader");
  const category = candidates.find((candidate) => candidate.type === "category_concentration");
  const numeric = candidates.find((candidate) => candidate.type === "numeric_range");
  const warning = candidates.find((candidate) => candidate.type === "quality_warning");
  const usefulColumns = context.columns
    .filter((column) => ["number", "category", "date", "boolean"].includes(column.inferredType))
    .map((column) => column.name)
    .slice(0, 3);

  return [
    shape?.claim ?? `Таблица содержит ${formatDatasetShape(context.rowCount, context.columnCount)}.`,
    usefulColumns.length > 0
      ? `Наиболее полезные для обзора поля: ${usefulColumns.join(", ")}.`
      : "В таблице мало явно структурированных полей для сильного автоматического вывода.",
    groupLeader?.claim ?? category?.claim ?? "Самое надежное наблюдение связано со структурой строк и распределением заполненных значений.",
    numeric?.evidence ? `По числовым значениям видно: ${numeric.evidence}` : "Числовых показателей недостаточно для уверенного сравнения масштаба или разброса.",
    warning?.claim ? `Важная оговорка: ${warning.claim}` : "Серьезных предупреждений качества в подготовленном профиле не найдено.",
  ].join(" ");
}

export function buildLocalTextInsight(preprocessing: TextPreprocessingResult | undefined) {
  if (!preprocessing || preprocessing.stats.charCount === 0) {
    return "Текст принят, но в нем не найдено содержимого для надежного резюме. Для полноценного вывода нужен читаемый текстовый фрагмент. Сейчас невозможно выделить главную тему и ключевые тезисы. Проверьте, что файл содержит обычный текст, а не только вложения или неподдерживаемый формат. После этого LLM сможет подготовить краткое резюме из пяти предложений.";
  }

  const text = preprocessing.chunks
    .map((chunk) => chunk.text)
    .join("\n\n")
    .replace(/\s+/gu, " ")
    .trim();
  const sentences = text
    .match(/[^.!?…]+[.!?…]+|[^.!?…]+$/gu)
    ?.map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20) ?? [];
  const selectedSentences = sentences.slice(0, 5);

  if (selectedSentences.length > 0) {
    return selectedSentences.join(" ");
  }

  const compactText = text.slice(0, 520).trim();

  return compactText
    ? `Краткое содержание: ${compactText}${text.length > compactText.length ? "..." : "."}`
    : "Текст принят, но после очистки не осталось читаемых предложений для краткого резюме.";
}
