"use client";

import type { GraphPlot, LabelValue, PointValue } from "@/lib/graph-plot";
import { ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

const PALETTE = ["#2563eb", "#0f766e", "#d97706", "#be123c", "#7c3aed", "#475569"];
const SVG_WIDTH = 560;
const SVG_HEIGHT = 260;
const PADDING = 34;

type LabelSeriesPlot = {
  kind: "bar" | "line" | "histogram" | "pie" | "donut";
  type: GraphPlot["type"];
  title: string;
  description: string;
  xLabel: string | null;
  yLabel: string | null;
  points: LabelValue[];
  caveats: string[];
};

type ScatterPlotModel = Extract<GraphPlot, { kind: "scatter" }>;
type HeatmapPlotModel = Extract<GraphPlot, { kind: "heatmap" }>;
type KpiPlotModel = Extract<GraphPlot, { kind: "kpi" }>;
type TablePlotModel = Extract<GraphPlot, { kind: "table" }>;

type ActiveDatum = {
  label: string;
  value: string;
  detail?: string;
  color?: string;
};

type SortState = {
  column: string;
  direction: "asc" | "desc";
} | null;

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(value);
}

function maxValue(points: LabelValue[]) {
  return Math.max(...points.map((point) => point.value), 1);
}

function safeScale(value: number, min: number, max: number, size: number) {
  if (min === max) {
    return size / 2;
  }

  return ((value - min) / (max - min)) * size;
}

function normalizeSortValue(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  const raw = String(value ?? "").trim();
  const normalizedNumber = Number(raw.replace(/\s/g, "").replace(",", "."));

  return Number.isFinite(normalizedNumber) && raw !== "" ? normalizedNumber : raw.toLocaleLowerCase("ru-RU");
}

function ChartFrame({ plot, insight, children }: { plot: GraphPlot; insight?: string; children: ReactNode }) {
  const headerText = insight?.trim() || plot.description;

  return (
    <section
      data-testid="graphplot-panel"
      className="rounded-lg border border-ink/10 bg-white p-5 shadow-sm"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky">Инсайт по данным</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{plot.title}</h3>
          {headerText ? (
            <p data-testid={insight ? "data-insight" : undefined} className="mt-1 text-sm leading-6 text-graphite">
              {headerText}
            </p>
          ) : null}
        </div>
        <span
          data-testid="visualization-type"
          className="rounded-md bg-sky/10 px-3 py-2 font-mono text-sm font-semibold text-sky"
        >
          {plot.type}
        </span>
      </div>

      <div data-testid={`graphplot-${plot.type}`} className="mt-5">
        {children}
      </div>

      {plot.caveats.length > 0 ? (
        <ul className="mt-4 grid gap-2 text-sm text-graphite">
          {plot.caveats.slice(0, 3).map((caveat) => (
            <li key={caveat} className="rounded-md bg-[#fff7e8] px-3 py-2">
              {caveat}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ActiveReadout({ datum, fallback }: { datum: ActiveDatum | null; fallback: ActiveDatum }) {
  const visibleDatum = datum ?? fallback;

  return (
    <div
      data-testid="graphplot-active-value"
      className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-ink/10 bg-[#f8fafc] px-3 py-2 text-sm"
    >
      {visibleDatum.color ? (
        <span aria-hidden="true" className="h-3 w-3 rounded-sm" style={{ backgroundColor: visibleDatum.color }} />
      ) : null}
      <span className="font-semibold text-ink">{visibleDatum.label}</span>
      <span className="text-graphite">{visibleDatum.value}</span>
      {visibleDatum.detail ? <span className="text-graphite/80">{visibleDatum.detail}</span> : null}
    </div>
  );
}

function BarChart({ plot }: { plot: LabelSeriesPlot }) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(plot.points[0]?.label ?? null);
  const chartWidth = SVG_WIDTH - PADDING * 2;
  const chartHeight = SVG_HEIGHT - PADDING * 2;
  const barSlot = chartWidth / Math.max(plot.points.length, 1);
  const max = maxValue(plot.points);
  const activeLabel = hoveredLabel ?? selectedLabel;
  const activePoint = plot.points.find((point) => point.label === activeLabel) ?? plot.points[0];

  return (
    <div>
      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="h-auto w-full max-w-3xl" role="img">
        <line x1={PADDING} y1={SVG_HEIGHT - PADDING} x2={SVG_WIDTH - PADDING} y2={SVG_HEIGHT - PADDING} stroke="#cbd5e1" />
        <line x1={PADDING} y1={PADDING} x2={PADDING} y2={SVG_HEIGHT - PADDING} stroke="#cbd5e1" />
        {plot.points.map((point, index) => {
          const height = Math.max((point.value / max) * chartHeight, 3);
          const x = PADDING + index * barSlot + barSlot * 0.16;
          const y = SVG_HEIGHT - PADDING - height;
          const width = Math.max(barSlot * 0.68, 8);
          const color = PALETTE[index % PALETTE.length];
          const isActive = point.label === activeLabel;
          const hasActive = Boolean(activeLabel);

          return (
            <g key={point.label}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx="4"
                fill={color}
                stroke={isActive ? "#1f2933" : "transparent"}
                strokeWidth={isActive ? 2 : 0}
                opacity={hasActive && !isActive ? 0.38 : 1}
                className="cursor-pointer transition"
                role="button"
                tabIndex={0}
                aria-label={`${point.label}: ${formatNumber(point.value)}`}
                onClick={() => setSelectedLabel((current) => (current === point.label ? null : point.label))}
                onFocus={() => setHoveredLabel(point.label)}
                onBlur={() => setHoveredLabel(null)}
                onMouseEnter={() => setHoveredLabel(point.label)}
                onMouseLeave={() => setHoveredLabel(null)}
              >
                <title>{`${point.label}: ${formatNumber(point.value)}`}</title>
              </rect>
              <text x={x + width / 2} y={y - 6} textAnchor="middle" className="pointer-events-none fill-ink text-[11px] font-semibold">
                {formatNumber(point.value)}
              </text>
              <text x={x + width / 2} y={SVG_HEIGHT - 10} textAnchor="middle" className="pointer-events-none fill-graphite text-[10px]">
                {point.label.slice(0, 12)}
              </text>
            </g>
          );
        })}
      </svg>
      {activePoint ? (
        <ActiveReadout
          datum={{
            label: activePoint.label,
            value: formatNumber(activePoint.value),
            detail: plot.yLabel ?? undefined,
            color: PALETTE[Math.max(plot.points.findIndex((point) => point.label === activePoint.label), 0) % PALETTE.length],
          }}
          fallback={{ label: "Всего точек", value: formatNumber(plot.points.length) }}
        />
      ) : null}
    </div>
  );
}

function LineChart({ plot }: { plot: LabelSeriesPlot }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const values = plot.points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const chartWidth = SVG_WIDTH - PADDING * 2;
  const chartHeight = SVG_HEIGHT - PADDING * 2;
  const coords = plot.points.map((point, index) => {
    const x = PADDING + safeScale(index, 0, Math.max(plot.points.length - 1, 1), chartWidth);
    const y = SVG_HEIGHT - PADDING - safeScale(point.value, min, max, chartHeight);
    return { ...point, x, y };
  });
  const activeIndex = hoveredIndex ?? selectedIndex;
  const activePoint = coords[activeIndex] ?? coords[0];

  return (
    <div>
      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="h-auto w-full max-w-3xl" role="img">
        <line x1={PADDING} y1={SVG_HEIGHT - PADDING} x2={SVG_WIDTH - PADDING} y2={SVG_HEIGHT - PADDING} stroke="#cbd5e1" />
        <line x1={PADDING} y1={PADDING} x2={PADDING} y2={SVG_HEIGHT - PADDING} stroke="#cbd5e1" />
        {activePoint ? <line x1={activePoint.x} y1={PADDING} x2={activePoint.x} y2={SVG_HEIGHT - PADDING} stroke="#94a3b8" strokeDasharray="4 4" /> : null}
        <polyline
          points={coords.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="#2563eb"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {coords.map((point, index) => {
          const isActive = index === activeIndex;

          return (
            <g key={`${point.label}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={isActive ? 7 : 5}
                fill="#2563eb"
                stroke={isActive ? "#1f2933" : "white"}
                strokeWidth="2"
                className="cursor-pointer transition"
                role="button"
                tabIndex={0}
                aria-label={`${point.label}: ${formatNumber(point.value)}`}
                onClick={() => setSelectedIndex(index)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <title>{`${point.label}: ${formatNumber(point.value)}`}</title>
              </circle>
              <text x={point.x} y={point.y - 10} textAnchor="middle" className="pointer-events-none fill-ink text-[10px] font-semibold">
                {formatNumber(point.value)}
              </text>
            </g>
          );
        })}
        <text x={PADDING} y={SVG_HEIGHT - 10} className="fill-graphite text-[10px]">
          {plot.points[0]?.label}
        </text>
        <text x={SVG_WIDTH - PADDING} y={SVG_HEIGHT - 10} textAnchor="end" className="fill-graphite text-[10px]">
          {plot.points[plot.points.length - 1]?.label}
        </text>
      </svg>
      {activePoint ? (
        <ActiveReadout
          datum={{
            label: activePoint.label,
            value: formatNumber(activePoint.value),
            detail: plot.yLabel ?? undefined,
            color: "#2563eb",
          }}
          fallback={{ label: "Всего точек", value: formatNumber(plot.points.length) }}
        />
      ) : null}
    </div>
  );
}

function ScatterChart({ plot }: { plot: ScatterPlotModel }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const xs = plot.points.map((point) => point.x);
  const ys = plot.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const chartWidth = SVG_WIDTH - PADDING * 2;
  const chartHeight = SVG_HEIGHT - PADDING * 2;
  const activeIndex = hoveredIndex ?? selectedIndex;
  const activePoint = plot.points[activeIndex] ?? plot.points[0];

  return (
    <div>
      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="h-auto w-full max-w-3xl" role="img">
        <line x1={PADDING} y1={SVG_HEIGHT - PADDING} x2={SVG_WIDTH - PADDING} y2={SVG_HEIGHT - PADDING} stroke="#cbd5e1" />
        <line x1={PADDING} y1={PADDING} x2={PADDING} y2={SVG_HEIGHT - PADDING} stroke="#cbd5e1" />
        {plot.points.map((point: PointValue, index) => {
          const x = PADDING + safeScale(point.x, minX, maxX, chartWidth);
          const y = SVG_HEIGHT - PADDING - safeScale(point.y, minY, maxY, chartHeight);
          const isActive = index === activeIndex;

          return (
            <circle
              key={`${point.label}-${index}`}
              cx={x}
              cy={y}
              r={isActive ? 8 : 6}
              fill={PALETTE[index % PALETTE.length]}
              stroke={isActive ? "#1f2933" : "white"}
              strokeWidth="2"
              opacity={activeIndex !== null && !isActive ? 0.42 : 0.9}
              className="cursor-pointer transition"
              role="button"
              tabIndex={0}
              aria-label={`${plot.xLabel}: ${formatNumber(point.x)}, ${plot.yLabel}: ${formatNumber(point.y)}`}
              onClick={() => setSelectedIndex(index)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <title>{`${plot.xLabel}: ${formatNumber(point.x)}, ${plot.yLabel}: ${formatNumber(point.y)}`}</title>
            </circle>
          );
        })}
        <text x={SVG_WIDTH / 2} y={SVG_HEIGHT - 8} textAnchor="middle" className="fill-graphite text-[11px]">
          {plot.xLabel}
        </text>
        <text x={12} y={SVG_HEIGHT / 2} transform={`rotate(-90 12 ${SVG_HEIGHT / 2})`} textAnchor="middle" className="fill-graphite text-[11px]">
          {plot.yLabel}
        </text>
      </svg>
      {activePoint ? (
        <ActiveReadout
          datum={{
            label: activePoint.label,
            value: `${plot.xLabel}: ${formatNumber(activePoint.x)}`,
            detail: `${plot.yLabel}: ${formatNumber(activePoint.y)}`,
            color: PALETTE[Math.max(activeIndex, 0) % PALETTE.length],
          }}
          fallback={{ label: "Всего точек", value: formatNumber(plot.points.length) }}
        />
      ) : null}
    </div>
  );
}

function PieChart({ plot }: { plot: LabelSeriesPlot }) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(plot.points[0]?.label ?? null);
  const total = Math.max(plot.points.reduce((sum, point) => sum + point.value, 0), 1);
  const activeLabel = hoveredLabel ?? selectedLabel;
  const activePoint = plot.points.find((point) => point.label === activeLabel) ?? plot.points[0];
  let offset = 0;
  const gradient = plot.points
    .map((point, index) => {
      const start = offset;
      const end = offset + (point.value / total) * 100;
      offset = end;
      return `${PALETTE[index % PALETTE.length]} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-[240px_1fr]">
        <div
          className="relative mx-auto aspect-square w-full max-w-60 rounded-full shadow-inner ring-1 ring-ink/10"
          style={{ background: `conic-gradient(${gradient})` }}
          role="img"
          aria-label={plot.title}
        >
          {plot.kind === "donut" ? <span className="absolute inset-12 rounded-full bg-white" /> : null}
          {activePoint ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-full text-center text-sm font-semibold text-ink">
              <span className={plot.kind === "donut" ? "" : "rounded-md bg-white/88 px-2 py-1 shadow-sm"}>
                {Math.round((activePoint.value / total) * 100)}%
              </span>
            </span>
          ) : null}
        </div>
        <div className="grid content-center gap-2">
          {plot.points.map((point, index) => {
            const color = PALETTE[index % PALETTE.length];
            const isActive = point.label === activeLabel;

            return (
              <button
                key={point.label}
                type="button"
                className={[
                  "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-sky/35",
                  isActive ? "border-ink/20 bg-white shadow-sm" : "border-transparent bg-[#f8fafc] hover:border-sky/25",
                ].join(" ")}
                onClick={() => setSelectedLabel((current) => (current === point.label ? null : point.label))}
                onMouseEnter={() => setHoveredLabel(point.label)}
                onMouseLeave={() => setHoveredLabel(null)}
              >
                <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="truncate">{point.label}</span>
                </span>
                <span className="shrink-0 font-semibold text-ink">{formatNumber(point.value)}</span>
              </button>
            );
          })}
        </div>
      </div>
      {activePoint ? (
        <ActiveReadout
          datum={{
            label: activePoint.label,
            value: formatNumber(activePoint.value),
            detail: `${Math.round((activePoint.value / total) * 100)}%`,
            color: PALETTE[Math.max(plot.points.findIndex((point) => point.label === activePoint.label), 0) % PALETTE.length],
          }}
          fallback={{ label: "Всего", value: formatNumber(total) }}
        />
      ) : null}
    </div>
  );
}

function Heatmap({ plot }: { plot: HeatmapPlotModel }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(plot.cells[0] ? `${plot.cells[0].x}\u0000${plot.cells[0].y}` : null);
  const max = Math.max(...plot.cells.map((cell) => cell.value), 1);
  const activeKey = hoveredKey ?? selectedKey;
  const activeCell = plot.cells.find((cell) => `${cell.x}\u0000${cell.y}` === activeKey);

  return (
    <div>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[28rem] gap-1"
          style={{ gridTemplateColumns: `7rem repeat(${plot.xLabels.length}, minmax(4rem, 1fr))` }}
        >
          <div />
          {plot.xLabels.map((label) => (
            <div key={label} className="px-2 py-1 text-center text-xs font-semibold text-graphite">
              {label}
            </div>
          ))}
          {plot.yLabels.map((yLabel) => (
            <div key={yLabel} className="contents">
              <div className="px-2 py-3 text-sm font-semibold text-ink">{yLabel}</div>
              {plot.xLabels.map((xLabel) => {
                const cell = plot.cells.find((item) => item.x === xLabel && item.y === yLabel);
                const value = cell?.value ?? 0;
                const opacity = 0.14 + (value / max) * 0.76;
                const key = `${xLabel}\u0000${yLabel}`;
                const isActive = key === activeKey;

                return (
                  <button
                    key={`${xLabel}-${yLabel}`}
                    type="button"
                    className={[
                      "rounded-md px-2 py-3 text-center text-sm font-semibold text-ink transition focus:outline-none focus:ring-2 focus:ring-sky/35",
                      isActive ? "ring-2 ring-ink/40" : "hover:ring-2 hover:ring-sky/25",
                    ].join(" ")}
                    style={{ backgroundColor: `rgba(37, 99, 235, ${opacity})` }}
                    title={`${xLabel}, ${yLabel}: ${formatNumber(value)}`}
                    onClick={() => setSelectedKey((current) => (current === key ? null : key))}
                    onMouseEnter={() => setHoveredKey(key)}
                    onMouseLeave={() => setHoveredKey(null)}
                  >
                    {value > 0 ? formatNumber(value) : ""}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <ActiveReadout
        datum={
          activeCell
            ? {
                label: `${activeCell.x} / ${activeCell.y}`,
                value: formatNumber(activeCell.value),
                color: "#2563eb",
              }
            : null
        }
        fallback={{ label: "Ячеек", value: formatNumber(plot.cells.length), color: "#2563eb" }}
      />
    </div>
  );
}

function KpiCards({ plot }: { plot: KpiPlotModel }) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(plot.items[0]?.label ?? null);
  const activeItem = plot.items.find((item) => item.label === selectedLabel) ?? plot.items[0];

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plot.items.map((item, index) => {
          const isActive = item.label === selectedLabel;

          return (
            <button
              key={item.label}
              type="button"
              className={[
                "rounded-lg border bg-[#f8fafc] p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-sky/35",
                isActive ? "border-ink/20 shadow-sm" : "border-ink/10 hover:border-sky/30",
              ].join(" ")}
              onClick={() => setSelectedLabel((current) => (current === item.label ? null : item.label))}
            >
              <p className="text-sm font-medium text-graphite">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{formatNumber(item.value)}</p>
              <div className="mt-3 h-1.5 rounded-full" style={{ backgroundColor: PALETTE[index % PALETTE.length] }} />
            </button>
          );
        })}
      </div>
      {activeItem ? (
        <ActiveReadout
          datum={{
            label: activeItem.label,
            value: formatNumber(activeItem.value),
            color: PALETTE[Math.max(plot.items.findIndex((item) => item.label === activeItem.label), 0) % PALETTE.length],
          }}
          fallback={{ label: "Показателей", value: formatNumber(plot.items.length) }}
        />
      ) : null}
    </div>
  );
}

function DataTable({ plot }: { plot: TablePlotModel }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(plot.columns[0] ? { column: plot.columns[0], direction: "asc" } : null);
  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
    const filteredRows = normalizedQuery
      ? plot.rows.filter((row) =>
          plot.columns.some((column) => String(row[column] ?? "").toLocaleLowerCase("ru-RU").includes(normalizedQuery)),
        )
      : plot.rows;

    if (!sort) {
      return filteredRows;
    }

    return [...filteredRows].sort((left, right) => {
      const leftValue = normalizeSortValue(left[sort.column]);
      const rightValue = normalizeSortValue(right[sort.column]);

      if (leftValue === rightValue) {
        return 0;
      }

      const direction = sort.direction === "asc" ? 1 : -1;
      return leftValue > rightValue ? direction : -direction;
    });
  }, [plot.columns, plot.rows, query, sort]);

  const toggleSort = (column: string) => {
    setSort((current) => {
      if (!current || current.column !== column) {
        return { column, direction: "asc" };
      }

      return { column, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label className="relative block min-w-56 flex-1 sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite" />
          <input
            data-testid="graphplot-table-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск"
            className="h-10 w-full rounded-md border border-ink/12 bg-white pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-graphite/60 focus:border-sky focus:ring-2 focus:ring-sky/25"
          />
        </label>
        <span className="text-sm font-medium text-graphite">
          {formatNumber(visibleRows.length)} / {formatNumber(plot.rows.length)}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-ink/10">
        <table className="min-w-full divide-y divide-ink/10 text-sm">
          <thead className="bg-[#f8fafc]">
            <tr>
              {plot.columns.map((column) => (
                <th key={column} className="px-3 py-2 text-left font-semibold text-ink">
                  <button
                    type="button"
                    className="inline-flex max-w-56 items-center gap-2 text-left transition hover:text-sky focus:outline-none focus:ring-2 focus:ring-sky/25"
                    onClick={() => toggleSort(column)}
                  >
                    <span className="truncate">{column}</span>
                    <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/8 bg-white">
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="transition hover:bg-[#fff7e8]">
                {plot.columns.map((column) => (
                  <td key={column} className="max-w-56 truncate px-3 py-2 text-graphite">
                    {String(row[column] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function VisualizationPanel({ plot, insight }: { plot: GraphPlot; insight?: string }) {
  if (plot.kind === "empty") {
    return (
      <ChartFrame plot={plot} insight={insight}>
        <div className="rounded-lg border border-dashed border-ink/18 bg-[#f8fafc] p-5 text-sm leading-6 text-graphite">
          {plot.message}
        </div>
      </ChartFrame>
    );
  }

  if (plot.kind === "bar" || plot.kind === "histogram") {
    return (
      <ChartFrame plot={plot} insight={insight}>
        <BarChart plot={plot} />
      </ChartFrame>
    );
  }

  if (plot.kind === "line") {
    return (
      <ChartFrame plot={plot} insight={insight}>
        <LineChart plot={plot} />
      </ChartFrame>
    );
  }

  if (plot.kind === "scatter") {
    return (
      <ChartFrame plot={plot} insight={insight}>
        <ScatterChart plot={plot} />
      </ChartFrame>
    );
  }

  if (plot.kind === "pie" || plot.kind === "donut") {
    return (
      <ChartFrame plot={plot} insight={insight}>
        <PieChart plot={plot} />
      </ChartFrame>
    );
  }

  if (plot.kind === "heatmap") {
    return (
      <ChartFrame plot={plot} insight={insight}>
        <Heatmap plot={plot} />
      </ChartFrame>
    );
  }

  if (plot.kind === "kpi") {
    return (
      <ChartFrame plot={plot} insight={insight}>
        <KpiCards plot={plot} />
      </ChartFrame>
    );
  }

  if (plot.kind === "table") {
    return (
      <ChartFrame plot={plot} insight={insight}>
        <DataTable plot={plot} />
      </ChartFrame>
    );
  }

  return null;
}
