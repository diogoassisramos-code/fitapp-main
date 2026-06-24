import styles from "./ui.module.css";

/** Variantes de status do spec: ok/verde, late/vermelho, pending/amarelo, new/azul, off/cinza. */
export type BadgeVariant = "ok" | "late" | "pending" | "new" | "off";

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  ok: styles.badgeOk,
  late: styles.badgeLate,
  pending: styles.badgePending,
  new: styles.badgeNew,
  off: styles.badgeOff,
};

export function StatusBadge({
  variant,
  children,
  icon,
  noDot,
}: {
  variant: BadgeVariant;
  children: React.ReactNode;
  /** Ícone Tabler opcional (sem "ti ti-"); substitui o ponto. */
  icon?: string;
  /** Esconde o ponto (use quando houver ícone ou em pills de ação). */
  noDot?: boolean;
}) {
  const cls = [styles.badge, VARIANT_CLASS[variant]].join(" ");
  return (
    <span className={cls} data-nodot={icon || noDot ? "true" : undefined}>
      {icon && <i className={`ti ti-${icon}`} aria-hidden />}
      {children}
    </span>
  );
}
