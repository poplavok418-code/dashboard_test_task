const REQUIRED_OBJECT_KEYS = [
  "type",
  "title",
  "description",
  "encoding",
  "data_requirements",
  "display",
  "fallback",
  "caveats",
  "chart_candidate_id",
];

function extractJsonText(text) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response is not valid JSON.");
  }

  return trimmed.slice(start, end + 1);
}

function normalizeVisualization(block) {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    throw new Error("suggested_visualization must be an object.");
  }

  if (typeof block.type !== "string" || block.type.length === 0) {
    throw new Error("suggested_visualization.type is required.");
  }

  const normalized = {
    type: block.type,
    title: block.title ?? "",
    description: block.description ?? "",
    encoding: {
      x: block.encoding?.x ?? null,
      y: block.encoding?.y ?? null,
      category: block.encoding?.category ?? null,
      series: block.encoding?.series ?? null,
      value: block.encoding?.value ?? null,
      aggregation: block.encoding?.aggregation ?? null,
    },
    data_requirements: {
      required_columns: block.data_requirements?.required_columns ?? [],
      excluded_columns: block.data_requirements?.excluded_columns ?? [],
      filters: block.data_requirements?.filters ?? [],
      sort: {
        by: block.data_requirements?.sort?.by ?? null,
        direction: block.data_requirements?.sort?.direction ?? null,
      },
      limit: block.data_requirements?.limit ?? null,
      group_small_categories_as_other: block.data_requirements?.group_small_categories_as_other ?? false,
    },
    display: {
      x_axis_label: block.display?.x_axis_label ?? null,
      y_axis_label: block.display?.y_axis_label ?? null,
      legend_title: block.display?.legend_title ?? null,
      value_format: block.display?.value_format ?? null,
    },
    fallback: {
      type: block.fallback?.type ?? "data_table",
      reason: block.fallback?.reason ?? "",
    },
    caveats: block.caveats ?? [],
    chart_candidate_id: block.chart_candidate_id ?? null,
  };

  for (const key of REQUIRED_OBJECT_KEYS) {
    if (!(key in normalized)) {
      throw new Error(`suggested_visualization.${key} is missing.`);
    }
  }

  return normalized;
}

export function extractSuggestedVisualization(text) {
  let parsed;

  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch (error) {
    throw new Error(`Could not parse LLM JSON: ${error.message}`);
  }

  const block = parsed.suggested_visualization ?? parsed;
  return normalizeVisualization(block);
}
