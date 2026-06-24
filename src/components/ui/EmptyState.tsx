import styles from "./EmptyState.module.css";

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={styles.wrap} data-compact={compact || undefined}>
      <span className={styles.icon}>
        <i className={`ti ti-${icon}`} aria-hidden />
      </span>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.desc}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
