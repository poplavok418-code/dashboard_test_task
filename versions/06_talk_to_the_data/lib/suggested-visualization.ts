import type { SheetDatasetProfile } from "./input-preprocessing-types";
import type { VisualizationDecision, VisualizationType } from "./select-visualization";

export type Aggregation = "count" | "sum" | "avg" | "median" | "min" | "max";

export type SuggestedVisualization = {
  type: VisualizationType;
  title: string;
  description: string;
  encoding: {
    x: string | null;
    y: string | null;
    category: string | null;
    series: string | null;
    value: string | null;
    aggregation: Aggregation | null;
  };
  data_requirements: {
    required_columns: string[];
    excluded_columns: string[];
    filters: unknown[];
    sort: {
      by: string | null;
      direction: "asc" | "desc" | null;
    };
    limit: number | null;
    group_small_categories_as_other: boolean;
  };
  display: {
    x_axis_label: string | null;
    y_axis_label: string | null;
    legend_title: string | null;
    value_format: "number" | "percent" | "currency" | "integer" | null;
  };
  fallback: {
    type: "data_table" | "no_reliable_visualization";
    reason: string;
  };
  caveats: string[];
  chart_candidate_id: string | null;
};

function columnAt(decision: VisualizationDecision, index: number) {
  return decision.columns[index] ?? null;
}

function requiredColumns(...columns: Array<string | null>) {
  return [...new Set(columns.filter((column): column is string => Boolean(column)))];
}

export function makeSuggestedVisualization(
  decision: VisualizationDecision,
  dataset?: SheetDatasetProfile,
): SuggestedVisualization {
  const [first, second, third] = decision.columns;
  const base = {
    type: decision.type,
    title: decision.title,
    description: decision.description,
    encoding: {
      x: null,
      y: null,
      category: null,
      series: null,
      value: null,
      aggregation: null,
    },
    data_requirements: {
      required_columns: decision.columns,
      excluded_columns: dataset?.columns
        .filter((column) => column.flags.includes("id_like") || column.flags.includes("high_cardinality"))
        .map((column) => column.name) ?? [],
      filters: [],
      sort: {
        by: null,
        direction: null,
      },
      limit: null,
      group_small_categories_as_other: false,
    },
    display: {
      x_axis_label: first ?? null,
      y_axis_label: second ?? null,
      legend_title: null,
      value_format: "number",
    },
    fallback: {
      type: "data_table",
      reason: "Если график нельзя построить надежно, покажем табличный фрагмент.",
    },
    caveats: dataset?.warnings.map((warning) => warning.message) ?? [],
    chart_candidate_id: null,
  } satisfies SuggestedVisualization;

  if (decision.type === "line_chart") {
    return {
      ...base,
      encoding: { ...base.encoding, x: first, y: second, value: second, aggregation: "sum" },
      data_requirements: {
        ...base.data_requirements,
        required_columns: requiredColumns(first, second),
        sort: { by: first ?? null, direction: "asc" },
      },
    };
  }

  if (decision.type === "scatter_plot") {
    return {
      ...base,
      encoding: { ...base.encoding, x: first, y: second },
      data_requirements: { ...base.data_requirements, required_columns: requiredColumns(first, second) },
    };
  }

  if (decision.type === "histogram") {
    return {
      ...base,
      encoding: { ...base.encoding, x: first, value: first, aggregation: "count" },
      data_requirements: { ...base.data_requirements, required_columns: requiredColumns(first) },
    };
  }

  if (decision.type === "bar_chart") {
    return {
      ...base,
      encoding: { ...base.encoding, x: first, y: second, category: first, value: second, aggregation: "sum" },
      data_requirements: {
        ...base.data_requirements,
        required_columns: requiredColumns(first, second),
        limit: 8,
        group_small_categories_as_other: true,
      },
    };
  }

  if (decision.type === "pie_chart" || decision.type === "donut_chart") {
    return {
      ...base,
      encoding: { ...base.encoding, category: first, value: second, aggregation: "sum" },
      data_requirements: { ...base.data_requirements, required_columns: requiredColumns(first, second), limit: 8 },
    };
  }

  if (decision.type === "heatmap") {
    return {
      ...base,
      encoding: { ...base.encoding, x: first, y: second, value: third, aggregation: "sum" },
      data_requirements: { ...base.data_requirements, required_columns: requiredColumns(first, second, third), limit: 64 },
      display: { ...base.display, x_axis_label: first ?? null, y_axis_label: second ?? null },
    };
  }

  if (decision.type === "kpi_cards") {
    return {
      ...base,
      encoding: { ...base.encoding, category: columnAt(decision, 0), value: columnAt(decision, 1) },
      data_requirements: { ...base.data_requirements, required_columns: requiredColumns(first, second), limit: 6 },
    };
  }

  if (decision.type === "data_table") {
    return {
      ...base,
      display: { ...base.display, value_format: null },
      data_requirements: { ...base.data_requirements, required_columns: decision.columns, limit: 8 },
    };
  }

  return {
    ...base,
    fallback: {
      type: "no_reliable_visualization",
      reason: "Структура данных слишком неоднозначна для автоматического графика.",
    },
  };
}
