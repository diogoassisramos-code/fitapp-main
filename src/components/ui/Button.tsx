import Link from "next/link";
import styles from "./ui.module.css";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "md" | "sm";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: styles.btnPrimary,
  outline: styles.btnOutline,
  ghost: styles.btnGhost,
  danger: styles.btnDanger,
};

type BaseProps = {
  variant?: Variant;
  size?: Size;
  /** Nome do ícone Tabler (sem "ti ti-"), à esquerda. */
  icon?: string;
  /** Ícone à direita. */
  iconRight?: string;
  fullWidth?: boolean;
  children?: React.ReactNode;
  className?: string;
};

type ButtonAsButton = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & {
    href?: undefined;
  };

type ButtonAsLink = BaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  fullWidth,
  children,
  className,
  ...rest
}: ButtonProps) {
  const cls = [styles.btn, VARIANT_CLASS[variant], className]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      {icon && <i className={`ti ti-${icon}`} aria-hidden />}
      {children}
      {iconRight && <i className={`ti ti-${iconRight}`} aria-hidden />}
    </>
  );

  if ("href" in rest && rest.href) {
    const { href, ...anchorRest } = rest as ButtonAsLink;
    return (
      <Link
        href={href}
        className={cls}
        data-size={size}
        data-full={fullWidth || undefined}
        {...anchorRest}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      className={cls}
      data-size={size}
      data-full={fullWidth || undefined}
      {...(rest as ButtonAsButton)}
    >
      {inner}
    </button>
  );
}
