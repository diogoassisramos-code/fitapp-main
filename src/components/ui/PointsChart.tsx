"use client";

import * as React from "react";
import { Star } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import styles from "./PointsChart.module.css";

/**
 * Gráfico de linha (recharts) com grid tracejado, tooltip e linhas de nível
 * com estrela. Design adaptado ao sistema de tokens do Revo (CSS Modules
 * + variáveis CSS), sem Tailwind/shadcn.
 */
interface PointsChartDataPoint {
  date: string;
  total: number;
  change: number;
}

interface PointsChartLevel {
  value: number;
  color: string;
  label?: string;
}

interface PointsChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: PointsChartDataPoint[];
  height?: number;
  title?: string;
  headerRight?: React.ReactNode;
  yAxisLabel?: string;
  levels?: PointsChartLevel[];
  /** Formatação por função (use em Client Components). */
  formatValue?: (value: number) => string;
  /** Formato serializável (use em Server Components). */
  format?: "number" | "decimal1" | "currency" | "currencyK";
  /** Sufixo dos valores (ex.: " kg"). */
  unit?: string;
}

function makeFmt(format?: string, unit = "") {
  switch (format) {
    case "decimal1":
      return (v: number) => `${v.toFixed(1)}${unit}`;
    case "currency":
      return (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}${unit}`;
    case "currencyK":
      return (v: number) => `R$ ${(v / 1000).toFixed(0)}k${unit}`;
    default:
      return (v: number) => `${Math.round(v).toLocaleString("pt-BR")}${unit}`;
  }
}

function LevelReferenceStarLabel({
  viewBox,
  color,
}: {
  viewBox?: { x?: number; y?: number } | null;
  color: string;
}) {
  const x = viewBox?.x;
  const y = viewBox?.y;

  if (typeof x !== "number" || typeof y !== "number") {
    return null;
  }

  return (
    <g transform={`translate(${x - 14},${y})`}>
      <Star
        x={-5}
        y={-5}
        width={10}
        height={10}
        fill={color}
        stroke={color}
        strokeWidth={1.75}
      />
    </g>
  );
}

function PointsChart({
  data,
  height = 260,
  title,
  headerRight,
  yAxisLabel,
  levels,
  formatValue,
  format,
  unit,
  className,
  ...props
}: PointsChartProps) {
  const fmt = formatValue ?? makeFmt(format, unit);

  const yDomain = React.useMemo<[number, number]>(() => {
    const values = [
      ...data.map((item) => item.total),
      ...(levels?.map((level) => level.value) ?? []),
    ];

    if (values.length === 0) return [0, 100];

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    if (range === 0) {
      const padding = Math.max(maxValue * 0.15, 10);
      return [Math.max(0, minValue - padding), maxValue + padding];
    }

    const padding = Math.max(range * 0.12, 10);
    return [Math.max(0, minValue - padding), maxValue + padding];
  }, [data, levels]);

  return (
    <div
      className={[styles.card, className].filter(Boolean).join(" ")}
      {...props}
    >
      {(title || headerRight) && (
        <div className={styles.header}>
          {title && <p className={styles.title}>{title}</p>}
          {headerRight ? <div className={styles.headerRight}>{headerRight}</div> : null}
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid
              stroke="var(--color-border-tertiary)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-text-tertiary)", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              domain={yDomain}
              tick={{ fill: "var(--color-text-tertiary)", fontSize: 12 }}
              tickFormatter={fmt}
              width={64}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: "insideLeft",
                      fill: "var(--color-text-tertiary)",
                      fontSize: 12,
                      dx: -18,
                    }
                  : undefined
              }
            />
            {levels?.map((level) => (
              <ReferenceLine
                key={level.value}
                y={level.value}
                stroke={level.color}
                strokeDasharray="6 6"
                strokeWidth={2}
                label={{
                  position: "left",
                  content: (labelProps: { viewBox?: unknown }) => (
                    <LevelReferenceStarLabel
                      viewBox={
                        (labelProps.viewBox as { x?: number; y?: number } | null) ??
                        null
                      }
                      color={level.color}
                    />
                  ),
                }}
              />
            ))}
            <Tooltip
              cursor={{ stroke: "var(--color-text-info)", strokeDasharray: "4 4" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as PointsChartDataPoint;
                const changePrefix = row.change > 0 ? "+" : "";
                return (
                  <div className={styles.tooltip}>
                    <p className={styles.tooltipLabel}>{label}</p>
                    <p className={styles.tooltipTotal}>
                      Total {fmt(row.total)}
                    </p>
                    <p className={styles.tooltipChange}>
                      {changePrefix}
                      {fmt(row.change)}
                    </p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="var(--color-text-info)"
              strokeWidth={2}
              connectNulls
              dot={{ r: 3, fill: "var(--color-text-info)" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export { PointsChart };
export type { PointsChartDataPoint, PointsChartProps, PointsChartLevel };
