import styles from "./ui.module.css";

export function Input({
  label,
  hint,
  icon,
  prefix,
  id,
  className,
  ...rest
}: {
  label?: string;
  hint?: string;
  /** Ícone Tabler à esquerda (sem "ti ti-"). */
  icon?: string;
  /** Prefixo textual (ex.: "R$"). */
  prefix?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const input = (
    <div className={styles.inputWrap}>
      {icon && <i className={`ti ti-${icon}`} aria-hidden />}
      {prefix && <span className={styles.prefix}>{prefix}</span>}
      <input id={id} {...rest} />
    </div>
  );

  if (!label && !hint) return input;

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      {label && (
        <label className={styles.fieldLabel} htmlFor={id}>
          {label}
        </label>
      )}
      {input}
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </div>
  );
}
