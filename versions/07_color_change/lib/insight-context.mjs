function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(value);
}

function categoryCandidate(column, rowCount) {
  const top = column.categoryStats?.topValues?.[0];

  if (!top) {
    return undefined;
  }

  const share = rowCount > 0 ? top.count / rowCount : 0;

  return {
    type: "category_concentration",
    claim: `Самое частое значение в колонке ${column.name} - ${top.label}.`,
    evidence: `${top.label}: ${formatNumber(top.count)} строк (${Math.round(share * 100)}%).`,
    score: 0.8,
  };
}

function numericCandidate(column) {
  const stats = column.numericStats;

  if (!stats) {
    return undefined;
  }

  return {
    type: "numeric_range",
    claim: `Колонка ${column.name} находится в диапазоне от ${formatNumber(stats.min)} до ${formatNumber(stats.max)}.`,
    evidence: `Среднее ${formatNumber(stats.mean)}, медиана ${formatNumber(stats.median)}.`,
    score: 0.78,
  };
}

function chartCandidate(context) {
  const candidate = context.chartCandidates?.[0];

  if (!candidate) {
    return undefined;
  }

  return {
    type: "chart_signal",
    claim: `Для данных найден кандидат визуализации ${candidate.type}.`,
    evidence: candidate.reason ?? candidate.id ?? candidate.type,
    score: 0.7,
  };
}

function contextShare(count, total) {
  return total > 0 ? count / total : 0;
}

function compactColumn(column) {
  return {
    name: column.name,
    inferredType: column.inferredType,
    nonEmptyCount: column.nonEmptyCount,
    missingCount: column.missingCount,
    uniqueCount: column.uniqueCount,
    examples: column.flags?.includes("pii_like") ? [] : column.examples ?? [],
    flags: column.flags ?? [],
    numericStats: column.numericStats
      ? {
          min: column.numericStats.min,
          max: column.numericStats.max,
          mean: column.numericStats.mean,
          median: column.numericStats.median,
          sum: column.numericStats.sum,
        }
      : undefined,
    categoryStats: column.categoryStats
      ? {
          topValues: (column.categoryStats.topValues ?? []).map((item) => ({
            label: item.label,
            count: item.count,
            share: contextShare(item.count, column.nonEmptyCount),
          })),
        }
      : undefined,
  };
}

function insightCandidates(context) {
  const candidates = [
    {
      type: "dataset_shape",
      claim: `Таблица содержит ${formatNumber(context.rowCount)} строк и ${formatNumber(context.columnCount)} колонок.`,
      evidence: `${formatNumber(context.rowCount)} строк, ${formatNumber(context.columnCount)} колонок.`,
      score: 0.6,
    },
    chartCandidate(context),
    ...context.columns
      .filter((column) => ["category", "boolean"].includes(column.inferredType))
      .slice(0, 2)
      .map((column) => categoryCandidate(column, context.rowCount)),
    ...context.columns
      .filter((column) => column.inferredType === "number" && !column.flags?.includes("id_like"))
      .slice(0, 3)
      .map(numericCandidate),
    ...(context.warnings ?? []).slice(0, 2).map((warning) => ({
      type: "quality_warning",
      claim: warning.message,
      evidence: warning.code,
      score: 0.5,
    })),
  ].filter(Boolean);

  return candidates.sort((left, right) => right.score - left.score).slice(0, 8);
}

export function buildInsightContextFromDatasetContext(context) {
  return {
    sourceType: "sheet",
    fileName: context.fileName,
    sheetName: context.sheetName,
    rowCount: context.rowCount,
    columnCount: context.columnCount,
    columns: context.columns.map(compactColumn),
    insightCandidates: insightCandidates(context),
    warnings: (context.warnings ?? []).map((warning) => ({ code: warning.code, message: warning.message })),
    sample: {
      columns: context.sample?.columns ?? [],
      rows: (context.sample?.rows ?? []).slice(0, 30),
    },
  };
}
