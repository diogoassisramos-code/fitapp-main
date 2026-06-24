import styles from "./Charts.module.css";

export type ChartPoint = { label: string; value: number };

/** Gráfico de linha (ex.: evolução do peso). SVG responsivo, sem dependências. */
export function LineChart({
  data,
  height = 220,
  formatValue = (v) => String(v),
  unit,
}: {
  data: ChartPoint[];
  height?: number;
  formatValue?: (v: number) => string;
  unit?: string;
}) {
  const W = 640;
  const H = height;
  const padX = 36;
  const padTop = 24;
  const padBottom = 32;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const lo = min - range * 0.2;
  const hi = max + range * 0.2;

  const x = (i: number) =>
    padX + (i * (W - padX * 2)) / Math.max(1, data.length - 1);
  const y = (v: number) =>
    padTop + ((hi - v) / (hi - lo)) * (H - padTop - padBottom);

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.value)}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${x(data.length - 1)} ${H - padBottom} L ${x(0)} ${H - padBottom} Z`;

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-text-info)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--color-text-info)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Linhas de grade */}
      {[0, 0.5, 1].map((t) => {
        const gy = padTop + t * (H - padTop - padBottom);
        return (
          <line
            key={t}
            x1={padX}
            x2={W - padX}
            y1={gy}
            y2={gy}
            className={styles.grid}
          />
        );
      })}

      <path d={areaPath} fill="url(#lineFill)" />
      <path d={linePath} className={styles.line} />

      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.value)} r={4} className={styles.dot} />
          <text x={x(i)} y={H - 10} className={styles.xlabel} textAnchor="middle">
            {d.label}
          </text>
        </g>
      ))}

      {/* Rótulo do último ponto */}
      <text
        x={x(data.length - 1)}
        y={y(values[values.length - 1]) - 12}
        className={styles.valueLabel}
        textAnchor="middle"
      >
        {formatValue(values[values.length - 1])}
        {unit}
      </text>
    </svg>
  );
}

/** Gráfico de barras (ex.: faturamento por mês). */
export function BarChart({
  data,
  height = 220,
  formatValue = (v) => String(v),
}: {
  data: ChartPoint[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const W = 640;
  const H = height;
  const padX = 16;
  const padTop = 28;
  const padBottom = 30;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const slot = (W - padX * 2) / data.length;
  const barW = Math.min(56, slot * 0.56);

  return (
    <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = ((d.value / max) * (H - padTop - padBottom)) || 0;
        const cx = padX + i * slot + slot / 2;
        const bx = cx - barW / 2;
        const by = H - padBottom - h;
        const last = i === data.length - 1;
        return (
          <g key={i}>
            <rect
              x={bx}
              y={by}
              width={barW}
              height={h}
              rx={6}
              className={last ? styles.barActive : styles.bar}
            />
            <text x={cx} y={by - 8} className={styles.barValue} textAnchor="middle">
              {formatValue(d.value)}
            </text>
            <text x={cx} y={H - 9} className={styles.xlabel} textAnchor="middle">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
