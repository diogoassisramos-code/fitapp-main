import styles from "./ui.module.css";

export function Card({
  children,
  padded,
  className,
  ...rest
}: {
  children: React.ReactNode;
  /** Aplica padding interno padrão. Use false quando o conteúdo for uma lista. */
  padded?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const cls = [styles.card, padded && styles.cardPad, className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.cardHeader}>
      <div className={styles.cardTitle}>{title}</div>
      {action}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={[styles.cardBody, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
