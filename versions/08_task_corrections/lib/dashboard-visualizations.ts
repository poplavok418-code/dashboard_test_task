import type { SheetDatasetProfile } from "./input-preprocessing-types";
import { makeSuggestedVisualization, type SuggestedVisualization } from "./suggested-visualization";
import type { VisualizationDecision, VisualizationType } from "./select-visualization";

function usableNumbers(dataset: SheetDatasetProfile) {
  return dataset.columns.filter(
    (column) =>
      column.inferredType === "number" &&
      !column.flags.includes("id_like") &&
      !column.flags.includes("mostly_missing"),
  );
}

function usableDates(dataset: SheetDatasetProfile) {
  return dataset.columns.filter((column) => column.inferredType === "date" && !column.flags.includes("mostly_missing"));
}

function usableCategories(dataset: SheetDatasetProfile) {
  return dataset.columns.filter(
    (column) =>
      ["category", "boolean"].includes(column.inferredType) &&
      !column.flags.includes("high_cardinality") &&
      !column.flags.includes("mostly_missing") &&
      (column.uniqueCount ?? 0) >= 2 &&
      (column.uniqueCount ?? 0) <= 30,
  );
}

function decision(type: VisualizationType, title: string, description: string, columns: string[]): VisualizationDecision {
  return { type, title, description, columns };
}

function signature(visualization: SuggestedVisualization) {
  return [
    visualization.type,
    visualization.data_requirements.required_columns.join("|"),
    visualization.encoding.x,
    visualization.encoding.y,
    visualization.encoding.category,
    visualization.encoding.value,
  ].join("::");
}

function secondaryCandidates(dataset: SheetDatasetProfile) {
  const numbers = usableNumbers(dataset);
  const dates = usableDates(dataset);
  const categories = usableCategories(dataset);
  const candidates: VisualizationDecision[] = [];

  if (dates[0] && numbers[0]) {
    candidates.push(decision(
      "line_chart",
      "Динамика показателя",
      "Показываем изменение числового показателя по датам.",
      [dates[0].name, numbers[0].name],
    ));
  }

  if (categories[0] && numbers[0]) {
    candidates.push(decision(
      "bar_chart",
      "Сравнение групп",
      "Сравниваем категории по основному числовому показателю.",
      [categories[0].name, numbers[0].name],
    ));
  }

  if (numbers[0]) {
    candidates.push(decision(
      "histogram",
      "Распределение значений",
      "Показываем, как распределен главный числовой показатель.",
      [numbers[0].name],
    ));
  }

  if (numbers[0] && numbers[1]) {
    candidates.push(decision(
      "scatter_plot",
      "Связь числовых полей",
      "Проверяем взаимное расположение двух числовых показателей.",
      [numbers[0].name, numbers[1].name],
    ));
  }

  if (categories[0] && categories[1] && numbers[0]) {
    candidates.push(decision(
      "heatmap",
      "Матрица сегментов",
      "Раскладываем показатель по двум компактным измерениям.",
      [categories[0].name, categories[1].name, numbers[0].name],
    ));
  }

  if (categories[0] && numbers[0] && (categories[0].uniqueCount ?? 99) <= 6) {
    candidates.push(decision(
      "donut_chart",
      "Доля по категориям",
      "Показываем компактное соотношение небольшого числа категорий.",
      [categories[0].name, numbers[0].name],
    ));
  }

  if (dataset.rowCount > 0 && dataset.columnCount > 1) {
    candidates.push(decision(
      "data_table",
      "Фрагмент данных",
      "Оставляем табличный срез как проверочный вид исходных строк.",
      dataset.columns.slice(0, 4).map((column) => column.name),
    ));
  }

  return candidates;
}

export function buildDashboardVisualizations(
  dataset: SheetDatasetProfile | undefined,
  primary: SuggestedVisualization,
) {
  if (!dataset) {
    return [primary];
  }

  const visualizations: SuggestedVisualization[] = [primary];
  const seen = new Set(visualizations.map(signature));

  for (const candidate of secondaryCandidates(dataset)) {
    const visualization = makeSuggestedVisualization(candidate, dataset);
    const key = signature(visualization);

    if (!seen.has(key)) {
      visualizations.push(visualization);
      seen.add(key);
    }

    if (visualizations.length >= 3) {
      break;
    }
  }

  return visualizations.slice(0, 3);
}
