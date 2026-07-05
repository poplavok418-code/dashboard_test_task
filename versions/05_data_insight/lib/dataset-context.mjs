const MISSING_VALUES = new Set(["", "n/a", "na", "null", "none", "-", "—"]);

function sanitize(value) {
  return String(value ?? "").trim();
}

function isMissing(value) {
  return MISSING_VALUES.has(sanitize(value).toLowerCase());
}

function parseNumber(value) {
  const text = sanitize(value)
    .replace(/[₽$€£¥]|руб\.?|eur|usd|rur/giu, "")
    .replace(/%$/u, "")
    .replace(/\s/g, "");

  if (!text) {
    return undefined;
  }

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  let normalized = text;

  if (hasComma && hasDot) {
    const decimalSeparator = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = text.split(thousandsSeparator).join("").replace(decimalSeparator, ".");
  } else if (hasComma) {
    normalized = text.replace(",", ".");
  }

  if (!/^-?\d+(\.\d+)?$/u.test(normalized)) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isDateLike(value) {
  const text = sanitize(value);

  if (/^\d{4}-\d{2}-\d{2}/u.test(text)) {
    return !Number.isNaN(Date.parse(text));
  }

  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/u.test(text)) {
    const [day, month, year] = text.split(".").map(Number);
    return day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900;
  }

  return false;
}

function isBooleanLike(value) {
  return /^(true|false|yes|no|да|нет|1|0)$/iu.test(sanitize(value));
}

function normalizeHeaders(row) {
  const counts = new Map();

  return row.map((value, index) => {
    const base = sanitize(value) || `Column ${index + 1}`;
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    return seen === 0 ? base : `${base} ${seen + 1}`;
  });
}

function inferType(values) {
  const nonEmpty = values.filter((value) => !isMissing(value));

  if (nonEmpty.length === 0) {
    return "mixed";
  }

  const numericRatio = nonEmpty.filter((value) => parseNumber(value) !== undefined).length / nonEmpty.length;
  const dateRatio = nonEmpty.filter(isDateLike).length / nonEmpty.length;
  const booleanRatio = nonEmpty.filter(isBooleanLike).length / nonEmpty.length;
  const uniqueCount = new Set(nonEmpty.map((value) => sanitize(value).toLowerCase())).size;

  if (dateRatio >= 0.7) {
    return "date";
  }

  if (numericRatio >= 0.7) {
    return "number";
  }

  if (booleanRatio >= 0.7) {
    return "boolean";
  }

  if (uniqueCount <= 50 || uniqueCount / nonEmpty.length <= 0.5) {
    return "category";
  }

  if (Math.max(numericRatio, dateRatio, booleanRatio) >= 0.25) {
    return "mixed";
  }

  return "text";
}

function numericStats(values) {
  const numbers = values.map(parseNumber).filter((value) => value !== undefined).sort((a, b) => a - b);

  if (numbers.length === 0) {
    return undefined;
  }

  const sum = numbers.reduce((total, value) => total + value, 0);
  const middle = Math.floor(numbers.length / 2);

  return {
    min: numbers[0],
    max: numbers[numbers.length - 1],
    mean: Number((sum / numbers.length).toFixed(4)),
    median: numbers.length % 2 === 0 ? (numbers[middle - 1] + numbers[middle]) / 2 : numbers[middle],
  };
}

function categoryStats(values) {
  const counts = new Map();

  for (const value of values) {
    if (!isMissing(value)) {
      const label = sanitize(value);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return {
    topValues: [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([label, count]) => ({ label, count })),
  };
}

function dateStats(values) {
  const dates = values.filter(isDateLike).map((value) => sanitize(value)).sort();

  if (dates.length === 0) {
    return undefined;
  }

  return {
    minDate: dates[0],
    maxDate: dates[dates.length - 1],
    granularityHint: "day",
  };
}

function columnFlags(name, values, inferredType, uniqueCount) {
  const flags = [];
  const nonEmpty = values.filter((value) => !isMissing(value));
  const lowerName = name.toLowerCase();

  if (values.length > 0 && (values.length - nonEmpty.length) / values.length >= 0.5) {
    flags.push("mostly_missing");
  }

  if (uniqueCount > 50 || (nonEmpty.length >= 20 && uniqueCount / nonEmpty.length > 0.8)) {
    flags.push("high_cardinality");
  }

  if (/(^|[_\s-])(id|код|номер|invoice|user|customer)([_\s-]|$)/iu.test(lowerName)) {
    flags.push("id_like");
  }

  if (/email|phone|телефон|почта/iu.test(lowerName)) {
    flags.push("pii_like");
  }

  if (inferredType === "mixed") {
    flags.push("mixed");
  }

  return flags;
}

function createColumns(headers, dataRows) {
  return headers.map((name, index) => {
    const values = dataRows.map((row) => sanitize(row[index]));
    const nonEmpty = values.filter((value) => !isMissing(value));
    const uniqueCount = new Set(nonEmpty.map((value) => value.toLowerCase())).size;
    const inferredType = inferType(values);
    const examples = [...new Set(nonEmpty)].slice(0, 3);

    return {
      name,
      inferredType,
      nonEmptyCount: nonEmpty.length,
      missingCount: values.length - nonEmpty.length,
      uniqueCount,
      examples,
      numericStats: inferredType === "number" ? numericStats(values) : undefined,
      categoryStats: inferredType === "category" || inferredType === "boolean" ? categoryStats(values) : undefined,
      dateStats: inferredType === "date" ? dateStats(values) : undefined,
      flags: columnFlags(name, values, inferredType, uniqueCount),
    };
  });
}

function isUsableNumber(column) {
  return column.inferredType === "number" && !column.flags.includes("id_like") && !column.flags.includes("mostly_missing");
}

function isUsableCategory(column) {
  return ["category", "boolean"].includes(column.inferredType) && column.uniqueCount >= 2 && column.uniqueCount <= 50;
}

function makeCandidate(type, fields) {
  return {
    id: [type, fields.x, fields.y, fields.category, fields.value].filter(Boolean).join("_"),
    type,
    ...fields,
  };
}

function buildChartCandidates(columns) {
  const numbers = columns.filter(isUsableNumber);
  const dates = columns.filter((column) => column.inferredType === "date" && !column.flags.includes("mostly_missing"));
  const categories = columns.filter(isUsableCategory);
  const dimensions = [...categories, ...dates];
  const candidates = [];

  for (const date of dates) {
    for (const number of numbers) {
      candidates.push(makeCandidate("line_chart", {
        x: date.name,
        y: number.name,
        value: number.name,
        aggregation: "sum",
        reason: "Reliable date/time column plus numeric measure.",
      }));
    }
  }

  if (numbers.length >= 2) {
    candidates.push(makeCandidate("scatter_plot", {
      x: numbers[0].name,
      y: numbers[1].name,
      value: null,
      aggregation: null,
      reason: "Two reliable numeric columns can show relationship or outliers.",
    }));
  }

  if (numbers.length >= 1) {
    candidates.push(makeCandidate("histogram", {
      x: numbers[0].name,
      y: null,
      value: numbers[0].name,
      aggregation: "count",
      reason: "One numeric column can show distribution.",
    }));
  }

  for (const category of categories) {
    for (const number of numbers) {
      candidates.push(makeCandidate("bar_chart", {
        x: category.name,
        y: number.name,
        category: category.name,
        value: number.name,
        aggregation: "sum",
        reason: "Category column plus numeric measure.",
      }));

      if ((category.uniqueCount ?? 0) <= 8 && (number.numericStats?.min ?? 0) >= 0) {
        candidates.push(makeCandidate("pie_chart", {
          category: category.name,
          value: number.name,
          aggregation: "sum",
          reason: "Small category set with positive numeric values can show part of whole.",
        }));
        candidates.push(makeCandidate("donut_chart", {
          category: category.name,
          value: number.name,
          aggregation: "sum",
          reason: "Small category set with positive numeric values can show a compact part-of-whole dashboard view.",
        }));
      }
    }
  }

  if (dimensions.length >= 2 && numbers.length >= 1) {
    candidates.push(makeCandidate("heatmap", {
      x: dimensions[0].name,
      y: dimensions[1].name,
      value: numbers[0].name,
      aggregation: "sum",
      reason: "Two compact dimensions plus one numeric measure can form a grid.",
    }));
  }

  if (candidates.length === 0) {
    candidates.push(makeCandidate("data_table", {
      reason: "No reliable automatic chart candidate found.",
    }));
  }

  return candidates;
}

export function buildDatasetContext(parsedSheet) {
  const normalizedRows = parsedSheet.rows
    .map((row) => row.map(sanitize))
    .filter((row) => row.some((cell) => !isMissing(cell)));

  if (normalizedRows.length < 2) {
    throw new Error("Sheet must contain a header row and at least one data row.");
  }

  const [headerRow, ...dataRows] = normalizedRows;
  const headers = normalizeHeaders(headerRow);
  const columns = createColumns(headers, dataRows);
  const sampleRows = dataRows.slice(0, 50).map((row) => headers.map((_, index) => sanitize(row[index])));
  const warnings = [];

  if (columns.some((column) => column.flags.includes("id_like"))) {
    warnings.push({ code: "id_like_columns", message: "Some columns look like identifiers and should not be treated as measures." });
  }

  if (columns.some((column) => column.flags.includes("high_cardinality"))) {
    warnings.push({ code: "high_cardinality_columns", message: "Some categorical columns have many unique values." });
  }

  if (columns.some((column) => column.flags.includes("mostly_missing"))) {
    warnings.push({ code: "mostly_missing_columns", message: "Some columns have many missing values." });
  }

  return {
    sourceType: "sheet",
    fileName: parsedSheet.sourceName,
    sheetName: parsedSheet.sheetName,
    extension: parsedSheet.extension,
    delimiter: parsedSheet.delimiter,
    rowCount: dataRows.length,
    columnCount: headers.length,
    columns,
    sample: {
      columns: headers,
      rows: sampleRows,
    },
    chartCandidates: buildChartCandidates(columns),
    warnings,
  };
}
