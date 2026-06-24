import styles from "./ui.module.css";

export type MetricDelta = {
  value: string;
  dir: "up" | "down" | "flat";
};

export function MetricCard({
  label,
  value,
  sub,
  delta,
  icon,
  action,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: MetricDelta;
  /** Ícone Tabler (sem "ti ti-"). */
  icon?: string;
  /** Ação opcional (ex.: botão "Sacar"). */
  action?: React.ReactNode;
}) {
  const deltaIcon =
    delta?.dir === "up"
      ? "trending-up"
      : delta?.dir === "down"
        ? "trending-down"
        : "minus";

  return (
    <div className={styles.metric}>
      <div className={styles.metricTop}>
        <span className={styles.metricLabel}>{label}</span>
        {icon && (
          <span className={styles.metricIcon}>
            <i className={`ti ti-${icon}`} aria-hidden />
          </span>
        )}
      </div>

      <div className={styles.metricValueRow}>
        <span className={styles.metricValue}>{value}</span>
        {delta && (
          <span className={styles.metricDelta} data-dir={delta.dir}>
            <i className={`ti ti-${deltaIcon}`} aria-hidden />
            {delta.value}
          </span>
        )}
      </div>

      {sub && <span className={styles.metricSub}>{sub}</span>}
      {action && <div className={styles.metricAction}>{action}</div>}
    </div>
  );
}
