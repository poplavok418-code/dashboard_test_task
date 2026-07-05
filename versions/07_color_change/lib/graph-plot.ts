import type { SheetDatasetProfile } from "./input-preprocessing-types";
import type { SuggestedVisualization } from "./suggested-visualization";

export type LabelValue = {
  label: string;
  value: number;
};

export type PointValue = {
  x: number;
  y: number;
  label: string;
};

export type HeatmapCell = {
  x: string;
  y: string;
  value: number;
};

export type GraphPlot =
  | {
      kind: "empty";
      type: SuggestedVisualization["type"];
      title: string;
      description: string;
      message: string;
      caveats: string[];
    }
  | {
      kind: "bar" | "line" | "histogram" | "pie" | "donut";
      type: SuggestedVisualization["type"];
      title: string;
      description: string;
      xLabel: string | null;
      yLabel: string | null;
      points: LabelValue[];
      caveats: string[];
    }
  | {
      kind: "scatter";
      type: "scatter_plot";
      title: string;
      description: string;
      xLabel: string | null;
      yLabel: string | null;
      points: PointValue[];
      caveats: string[];
    }
  | {
      kind: "heatmap";
      type: "heatmap";
      title: string;
      description: string;
      xLabels: string[];
      yLabels: string[];
      cells: HeatmapCell[];
      caveats: string[];
    }
  | {
      kind: "kpi";
      type: "kpi_cards";
      title: string;
      description: string;
      items: LabelValue[];
      caveats: string[];
    }
  | {
      kind: "table";
      type: "data_table";
      title: string;
      description: string;
      columns: string[];
      rows: Array<Record<string, unknown>>;
      caveats: string[];
    };

const MISSING_VALUES = new Set(["", "n/a", "na", "null", "none", "-", "—"]);

function text(value: unknown) {
  return String(value ?? "").trim();
}

function isMissing(value: unknown) {
  return MISSING_VALUES.has(text(value).toLowerCase());
}

function numberFromValue(value: unknown) {
  const raw = text(value)
    .replace(/[₽$€£¥]|руб\.?|eur|usd|rur/giu, "")
    .replace(/%$/u, "")
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

function dateSortValue(value: string) {
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/u.test(value)) {
    const [day, month, year] = value.split(".").map(Number);
    return new Date(year, month - 1, day).getTime();
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : parsed;
}

function ensureColumns(dataset: SheetDatasetProfile, columns: string[]) {
  const existing = new Set(dataset.columns.map((column) => column.name));
  return columns.every((column) => existing.has(column));
}

function aggregate(values: number[], aggregation: SuggestedVisualization["encoding"]["aggregation"]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);

  if (aggregation === "count") {
    return values.length;
  }

  if (aggregation === "avg") {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  if (aggregation === "median") {
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  }

  if (aggregation === "min") {
    return sorted[0];
  }

  if (aggregation === "max") {
    return sorted[sorted.length - 1];
  }

  return values.reduce((sum, value) => sum + value, 0);
}

function aggregateByLabel(
  rows: Array<Record<string, unknown>>,
  labelColumn: string,
  valueColumn: string | null,
  aggregation: SuggestedVisualization["encoding"]["aggregation"],
) {
  const grouped = new Map<string, number[]>();

  for (const row of rows) {
    const label = text(row[labelColumn]);

    if (!label) {
      continue;
    }

    const value = valueColumn ? numberFromValue(row[valueColumn]) : 1;

    if (value === undefined) {
      continue;
    }

    grouped.set(label, [...(grouped.get(label) ?? []), value]);
  }

  return [...grouped.entries()]
    .map(([label, values]) => ({ label, value: aggregate(values, aggregation ?? "sum") }))
    .sort((left, right) => right.value - left.value);
}

function limitPoints(
  points: LabelValue[],
  limit: number | null,
) {
  const max = limit ?? 8;

  if (points.length <= max) {
    return points;
  }

  const visible = points.slice(0, Math.max(max - 1, 1));
  const rest = points.slice(visible.length);

  return [
    ...visible,
    {
      label: "Другие",
      value: rest.reduce((sum, point) => sum + point.value, 0),
    },
  ];
}

function tablePlot(dataset: SheetDatasetProfile, visualization: SuggestedVisualization): GraphPlot {
  const preferredColumns = visualization.data_requirements.required_columns.filter(Boolean);
  const columns = preferredColumns.length > 0 ? preferredColumns : dataset.columns.slice(0, 5).map((column) => column.name);

  return {
    kind: "table",
    type: "data_table",
    title: visualization.title || "Таблица данных",
    description: visualization.description || "Показываем подготовленные строки из исходного файла.",
    columns,
    rows: dataset.rows,
    caveats: visualization.caveats,
  };
}

function fullRows(dataset: SheetDatasetProfile) {
  return dataset.rows.length > 0 ? dataset.rows : dataset.previewRows;
}

function emptyPlot(
  visualization: SuggestedVisualization,
  message = "Не удалось построить надежный график по выбранным колонкам.",
): GraphPlot {
  return {
    kind: "empty",
    type: visualization.type,
    title: visualization.title || "Визуализация не выбрана",
    description: visualization.description,
    message,
    caveats: visualization.caveats,
  };
}

function histogram(values: number[], binCount = 5) {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ label: `${min}`, value: values.length }];
  }

  const step = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: min + step * index,
    end: index === binCount - 1 ? max : min + step * (index + 1),
    count: 0,
  }));

  for (const value of values) {
    const index = Math.min(Math.floor((value - min) / step), binCount - 1);
    bins[index].count += 1;
  }

  return bins.map((bin) => ({
    label: `${Math.round(bin.start)}-${Math.round(bin.end)}`,
    value: bin.count,
  }));
}

export function buildGraphPlot(
  dataset: SheetDatasetProfile | undefined,
  visualization: SuggestedVisualization,
): GraphPlot {
  if (!dataset) {
    return emptyPlot(visualization, "В файле не найден набор данных для построения графика.");
  }

  const requiredColumns = visualization.data_requirements.required_columns;

  if (requiredColumns.length > 0 && !ensureColumns(dataset, requiredColumns)) {
    return tablePlot(dataset, {
      ...visualization,
      title: visualization.fallback.reason || "Колонки графика не найдены",
      data_requirements: { ...visualization.data_requirements, required_columns: [] },
    });
  }

  if (visualization.type === "data_table") {
    return tablePlot(dataset, visualization);
  }

  if (visualization.type === "no_reliable_visualization") {
    return emptyPlot(visualization, visualization.fallback.reason);
  }

  if (visualization.type === "kpi_cards") {
    const labelColumn = visualization.encoding.category;
    const valueColumn = visualization.encoding.value;

    if (!labelColumn || !valueColumn) {
      return emptyPlot(visualization);
    }

    const items = fullRows(dataset)
      .map((row) => ({ label: text(row[labelColumn]), value: numberFromValue(row[valueColumn]) }))
      .filter((item): item is LabelValue => Boolean(item.label) && item.value !== undefined);

    return items.length > 0
      ? { kind: "kpi", type: "kpi_cards", title: visualization.title, description: visualization.description, items, caveats: visualization.caveats }
      : emptyPlot(visualization);
  }

  if (visualization.type === "histogram") {
    const valueColumn = visualization.encoding.value ?? visualization.encoding.x;
    const values = valueColumn
      ? fullRows(dataset).map((row) => numberFromValue(row[valueColumn])).filter((value): value is number => value !== undefined)
      : [];
    const points = histogram(values);

    return points.length > 0
      ? {
          kind: "histogram",
          type: "histogram",
          title: visualization.title,
          description: visualization.description,
          xLabel: visualization.display.x_axis_label,
          yLabel: "Количество",
          points,
          caveats: visualization.caveats,
        }
      : emptyPlot(visualization);
  }

  if (visualization.type === "scatter_plot") {
    const xColumn = visualization.encoding.x;
    const yColumn = visualization.encoding.y;

    if (!xColumn || !yColumn) {
      return emptyPlot(visualization);
    }

    const points = fullRows(dataset)
      .map((row) => {
        const x = numberFromValue(row[xColumn]);
        const y = numberFromValue(row[yColumn]);
        return x === undefined || y === undefined ? undefined : { x, y, label: `${x}; ${y}` };
      })
      .filter((point): point is PointValue => Boolean(point));

    return points.length > 0
      ? {
          kind: "scatter",
          type: "scatter_plot",
          title: visualization.title,
          description: visualization.description,
          xLabel: visualization.display.x_axis_label ?? xColumn,
          yLabel: visualization.display.y_axis_label ?? yColumn,
          points,
          caveats: visualization.caveats,
        }
      : emptyPlot(visualization);
  }

  if (visualization.type === "heatmap") {
    const xColumn = visualization.encoding.x;
    const yColumn = visualization.encoding.y;
    const valueColumn = visualization.encoding.value;

    if (!xColumn || !yColumn || !valueColumn) {
      return emptyPlot(visualization);
    }

    const grouped = new Map<string, number[]>();

    for (const row of fullRows(dataset)) {
      const x = text(row[xColumn]);
      const y = text(row[yColumn]);
      const value = numberFromValue(row[valueColumn]);

      if (!x || !y || value === undefined) {
        continue;
      }

      const key = `${x}\u0000${y}`;
      grouped.set(key, [...(grouped.get(key) ?? []), value]);
    }

    const cells = [...grouped.entries()].map(([key, values]) => {
      const [x, y] = key.split("\u0000");
      return { x, y, value: aggregate(values, visualization.encoding.aggregation ?? "sum") };
    });
    const xLabels = [...new Set(cells.map((cell) => cell.x))];
    const yLabels = [...new Set(cells.map((cell) => cell.y))];

    return cells.length > 0
      ? {
          kind: "heatmap",
          type: "heatmap",
          title: visualization.title,
          description: visualization.description,
          xLabels,
          yLabels,
          cells: cells.filter((cell) => xLabels.includes(cell.x) && yLabels.includes(cell.y)),
          caveats: visualization.caveats,
        }
      : emptyPlot(visualization);
  }

  if (visualization.type === "line_chart") {
    const xColumn = visualization.encoding.x;
    const valueColumn = visualization.encoding.value ?? visualization.encoding.y;

    if (!xColumn || !valueColumn) {
      return emptyPlot(visualization);
    }

    const points = aggregateByLabel(fullRows(dataset), xColumn, valueColumn, visualization.encoding.aggregation)
      .sort((left, right) => {
        const leftValue = dateSortValue(left.label);
        const rightValue = dateSortValue(right.label);
        return leftValue > rightValue ? 1 : leftValue < rightValue ? -1 : 0;
      });

    return points.length > 0
      ? {
          kind: "line",
          type: "line_chart",
          title: visualization.title,
          description: visualization.description,
          xLabel: visualization.display.x_axis_label ?? xColumn,
          yLabel: visualization.display.y_axis_label ?? valueColumn,
          points,
          caveats: visualization.caveats,
        }
      : emptyPlot(visualization);
  }

  if (visualization.type === "bar_chart" || visualization.type === "pie_chart" || visualization.type === "donut_chart") {
    const labelColumn = visualization.encoding.category ?? visualization.encoding.x;
    const valueColumn = visualization.encoding.value ?? visualization.encoding.y;

    if (!labelColumn) {
      return emptyPlot(visualization);
    }

    const points = limitPoints(
      aggregateByLabel(fullRows(dataset), labelColumn, valueColumn, visualization.encoding.aggregation)
        .filter((point) => (visualization.type === "bar_chart" ? true : point.value > 0)),
      visualization.data_requirements.limit,
    );

    if (points.length === 0) {
      return emptyPlot(visualization);
    }

    if (visualization.type === "pie_chart" || visualization.type === "donut_chart") {
      return {
        kind: visualization.type === "pie_chart" ? "pie" : "donut",
        type: visualization.type,
        title: visualization.title,
        description: visualization.description,
        xLabel: labelColumn,
        yLabel: valueColumn,
        points,
        caveats: visualization.caveats,
      };
    }

    return {
      kind: "bar",
      type: "bar_chart",
      title: visualization.title,
      description: visualization.description,
      xLabel: visualization.display.x_axis_label ?? labelColumn,
      yLabel: visualization.display.y_axis_label ?? valueColumn,
      points,
      caveats: visualization.caveats,
    };
  }

  return tablePlot(dataset, visualization);
}
