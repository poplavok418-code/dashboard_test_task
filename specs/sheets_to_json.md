# Sheets To JSON For LLM Context

Status: draft  
Scope: converting parsed sheet data from CSV, TSV, XLS, XLSX, and ODS files into a compact JSON context for local LLM agents.  
Out of scope: full-file storage, heavy backend ingestion, chart rendering, and final UI design.

## Goal

The LLM should not receive the full uploaded sheet file. Large or messy spreadsheets should be parsed and reduced first, then represented as a compact JSON profile plus a small row sample.

This keeps token usage low, makes local models more reliable, and prevents the model from doing work that deterministic code can do better.

## Recommended Approach

Use this pipeline for sheet-like files:

```txt
sheet file
  -> parse rows locally or in a backend worker
  -> normalize headers and values
  -> infer column types
  -> compute compact statistics and warnings
  -> generate deterministic chart candidates
  -> build LLM JSON context
  -> send only JSON context and small samples to the LLM
```

The LLM should receive:

- dataset metadata,
- column profiles,
- data quality warnings,
- deterministic chart candidates,
- a bounded sample of rows,
- optional compact aggregate previews.

The LLM should not receive:

- the full raw CSV/XLSX/ODS file,
- every parsed row,
- large text cells without truncation,
- chart-ready datasets above the rendering budget,
- unsupported sheets or hidden workbook internals.

## Why JSON Instead Of Raw Tables

Raw spreadsheet data is hard for smaller local models because it has weak type information, repeated formatting noise, ambiguous values, and too many rows.

Markdown tables can be useful for a tiny human-readable preview, but they lose important structure such as inferred types, missing counts, numeric ranges, ID-like flags, and chart eligibility.

JSON is better for the agent contract because it can explicitly describe what the app already knows about the dataset.

## Use Samples, Not Full Files

For the LLM-facing context, include only a small row sample. A practical default is 20-50 representative rows.

Recommended sample strategy:

- include the first 10-20 clean rows,
- include a few rows with missing or unusual values if present,
- include rows from different date ranges or categories when useful,
- truncate long cell text,
- cap the total sample size by characters and rows.

The sample is only evidence and orientation for the model. It should not be the only source of truth. Important facts such as row count, column count, totals, ranges, top categories, and missingness should come from deterministic profiling.

## JSON Shape

Use a compact format like this:

```json
{
  "sourceType": "sheet",
  "fileName": "sales_export.xlsx",
  "sheetName": "Sales",
  "rowCount": 12450,
  "columnCount": 5,
  "columns": [
    {
      "name": "date",
      "inferredType": "date",
      "nonEmptyCount": 12450,
      "missingCount": 0,
      "uniqueCount": 180,
      "examples": ["2026-01-01", "2026-01-02"],
      "dateStats": {
        "minDate": "2026-01-01",
        "maxDate": "2026-06-30",
        "granularityHint": "day"
      },
      "flags": []
    },
    {
      "name": "region",
      "inferredType": "category",
      "nonEmptyCount": 12420,
      "missingCount": 30,
      "uniqueCount": 6,
      "examples": ["Москва", "Санкт-Петербург"],
      "categoryStats": {
        "topValues": [
          { "label": "Москва", "count": 4300 },
          { "label": "Санкт-Петербург", "count": 2100 }
        ]
      },
      "flags": []
    },
    {
      "name": "revenue",
      "inferredType": "number",
      "nonEmptyCount": 12380,
      "missingCount": 70,
      "uniqueCount": 8320,
      "examples": ["120000", "98000"],
      "numericStats": {
        "min": 1200,
        "max": 930000,
        "mean": 84500,
        "median": 71200
      },
      "flags": []
    }
  ],
  "sample": {
    "columns": ["date", "region", "revenue"],
    "rows": [
      ["2026-01-01", "Москва", 120000],
      ["2026-01-02", "Санкт-Петербург", 98000]
    ]
  },
  "chartCandidates": [
    {
      "id": "revenue_by_date",
      "type": "line",
      "x": "date",
      "y": "revenue",
      "aggregation": "sum",
      "reason": "Date column and numeric revenue column are suitable for a time-series chart."
    },
    {
      "id": "revenue_by_region",
      "type": "bar",
      "x": "region",
      "y": "revenue",
      "aggregation": "sum",
      "reason": "Region is a low-cardinality category and revenue is a numeric measure."
    }
  ],
  "warnings": [
    {
      "code": "missing_values",
      "message": "Column revenue has 70 missing values."
    }
  ]
}
```

## Sample Encoding

Prefer compact row samples in this shape:

```json
{
  "columns": ["date", "region", "revenue"],
  "rows": [
    ["2026-01-01", "Москва", 120000],
    ["2026-01-02", "Санкт-Петербург", 98000]
  ]
}
```

This is usually better than an array of objects for samples because it avoids repeating column names on every row.

Use object-based rows only when readability is more important than token count or when the sample is extremely small.

## Optional Markdown Preview

A short Markdown table may be added for model readability, but it should be optional and small.

Example:

```md
| date | region | revenue |
|---|---|---:|
| 2026-01-01 | Москва | 120000 |
| 2026-01-02 | Санкт-Петербург | 98000 |
```

If both JSON and Markdown are provided, JSON remains the authoritative structure.

## LLM Responsibilities

The LLM may:

- classify the dataset in simple business terms,
- write a short Russian-language summary,
- choose 2-3 charts from the provided candidates,
- explain why those charts are useful,
- suggest caveats based on warnings.

The LLM must not:

- invent columns or metrics,
- request the full raw file by default,
- generate executable chart code,
- override deterministic chart guardrails,
- claim totals or trends that are not present in the JSON context.

## Validation Rule

Every chart returned by the LLM must be validated against the original column profiles and chart candidates before rendering.

If the LLM returns an invalid chart spec, the app should reject it and fall back to the best deterministic chart candidates.
