import Link from "next/link";
import styles from "./ui.module.css";

type ListRowProps = {
  /** Conteúdo à esquerda (avatar, ícone). */
  leading?: React.ReactNode;
  /** Linha 1 — título (flex:1). */
  title: React.ReactNode;
  /** Linha 1 — ação/elemento à direita (ex.: badge de pagamento). */
  action?: React.ReactNode;
  /** Linha 2 — metadados em largura cheia. */
  meta?: React.ReactNode;
  /** Linha 2 — tags/pills de ação. */
  tags?: React.ReactNode;
  href?: string;
  onClick?: () => void;
};

function Inner({ leading, title, action, meta, tags }: ListRowProps) {
  return (
    <>
      {leading && <div className={styles.rowLeading}>{leading}</div>}
      <div className={styles.rowMain}>
        <div className={styles.rowLine1}>
          <div className={styles.rowTitle}>{title}</div>
          {action && <div className={styles.rowAction}>{action}</div>}
        </div>
        {(meta || tags) && (
          <div className={styles.rowLine2}>
            {meta && <span className={styles.rowMeta}>{meta}</span>}
            {tags && <span className={styles.rowTags}>{tags}</span>}
          </div>
        )}
      </div>
    </>
  );
}

export function ListRow(props: ListRowProps) {
  const { href, onClick, ...rest } = props;

  if (href) {
    return (
      <Link href={href} className={styles.row}>
        <Inner {...rest} />
      </Link>
    );
  }

  if (onClick) {
    // role="button" num <div> (não <button>) para permitir elementos
    // interativos aninhados (KebabMenu, Links) sem HTML inválido.
    return (
      <div
        className={styles.row}
        role="button"
        tabIndex={0}
        data-clickable="true"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
      >
        <Inner {...rest} />
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <Inner {...rest} />
    </div>
  );
}
