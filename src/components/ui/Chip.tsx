import styles from "./ui.module.css";

export function Chip({
  selected,
  onClick,
  children,
  icon,
  count,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  /** Ícone Tabler opcional (sem "ti ti-"). */
  icon?: string;
  /** Contador opcional à direita (ex.: nº de resultados do filtro). */
  count?: number;
}) {
  return (
    <button
      type="button"
      className={styles.chip}
      data-selected={selected ? "true" : undefined}
      onClick={onClick}
    >
      {icon && <i className={`ti ti-${icon}`} aria-hidden />}
      {children}
      {count !== undefined && <span className={styles.chipCount}>{count}</span>}
    </button>
  );
}
