import type { PreprocessingResult, SheetDatasetProfile } from "./input-preprocessing-types";

export type VisualizationType =
  | "bar_chart"
  | "line_chart"
  | "scatter_plot"
  | "histogram"
  | "pie_chart"
  | "donut_chart"
  | "heatmap"
  | "data_table"
  | "kpi_cards"
  | "no_reliable_visualization";

export type VisualizationDecision = {
  type: VisualizationType;
  title: string;
  description: string;
  columns: string[];
};

function usableNumbers(dataset: SheetDatasetProfile) {
  return dataset.columns.filter(
    (column) =>
      column.inferredType === "number" &&
      !column.flags.includes("id_like") &&
      !column.flags.includes("mostly_missing"),
  );
}

function usableDates(dataset: SheetDatasetProfile) {
  return dataset.columns.filter(
    (column) => column.inferredType === "date" && !column.flags.includes("mostly_missing"),
  );
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

function bestDataset(preprocessing: PreprocessingResult) {
  if (preprocessing.kind !== "sheets") {
    return undefined;
  }

  return [...preprocessing.datasets].sort((left, right) => {
    const leftScore = left.rowCount * Math.max(left.columnCount, 1);
    const rightScore = right.rowCount * Math.max(right.columnCount, 1);

    return rightScore - leftScore;
  })[0];
}

export function selectVisualization(preprocessing?: PreprocessingResult): VisualizationDecision {
  if (!preprocessing) {
    return {
      type: "no_reliable_visualization",
      title: "Визуализация не выбрана",
      description: "Данные еще не подготовлены для выбора графика.",
      columns: [],
    };
  }

  if (preprocessing.kind === "text") {
    return {
      type: "data_table",
      title: "Текстовый ввод",
      description: "Для текста лучше показать фрагменты и краткое содержание, а не строить график.",
      columns: [],
    };
  }

  const dataset = bestDataset(preprocessing);

  if (!dataset) {
    return {
      type: "no_reliable_visualization",
      title: "Нет надежной таблицы",
      description: "В файле не найден набор данных, по которому можно выбрать график.",
      columns: [],
    };
  }

  const dates = usableDates(dataset);
  const numbers = usableNumbers(dataset);
  const categories = usableCategories(dataset);
  const dimensions = [...categories, ...dates];

  if (dates.length > 0 && numbers.length > 0) {
    return {
      type: "line_chart",
      title: "Линейный график",
      description: "Есть дата или время и числовой показатель, поэтому лучше показать динамику.",
      columns: [dates[0].name, numbers[0].name],
    };
  }

  if (numbers.length >= 2) {
    return {
      type: "scatter_plot",
      title: "Диаграмма рассеяния",
      description: "Есть две числовые колонки, поэтому можно показать связь, выбросы или кластеры.",
      columns: [numbers[0].name, numbers[1].name],
    };
  }

  if (numbers.length === 1 && categories.length === 0) {
    return {
      type: "histogram",
      title: "Гистограмма",
      description: "Есть один числовой показатель без надежной категории, поэтому лучше показать распределение.",
      columns: [numbers[0].name],
    };
  }

  if (categories.length > 0 && numbers.length > 0) {
    const smallCategory = (categories[0].uniqueCount ?? Number.POSITIVE_INFINITY) <= 6;

    if (smallCategory && dataset.rowCount <= 12) {
      return {
        type: "donut_chart",
        title: "Кольцевая диаграмма",
        description: "Категорий немного, а значения похожи на части целого.",
        columns: [categories[0].name, numbers[0].name],
      };
    }

    return {
      type: "bar_chart",
      title: "Столбчатая диаграмма",
      description: "Есть категория и числовой показатель, поэтому лучше сравнить группы.",
      columns: [categories[0].name, numbers[0].name],
    };
  }

  if (dimensions.length >= 2 && numbers.length > 0) {
    return {
      type: "heatmap",
      title: "Тепловая карта",
      description: "Есть две компактные размерности и числовое значение, которые можно разложить в матрицу.",
      columns: [dimensions[0].name, dimensions[1].name, numbers[0].name],
    };
  }

  if (dataset.rowCount > 0 && dataset.columnCount > 0) {
    return {
      type: "data_table",
      title: "Таблица данных",
      description: "Надежный график не найден, поэтому лучше показать данные в табличном виде.",
      columns: dataset.columns.slice(0, 4).map((column) => column.name),
    };
  }

  return {
    type: "no_reliable_visualization",
    title: "Визуализация не выбрана",
    description: "Структура данных слишком неоднозначная для автоматического выбора графика.",
    columns: [],
  };
}
