"use client";

import { useId } from "react";
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
  // Sem id explícito, gera um estável para o <label htmlFor> associar ao campo
  // (clicar no rótulo foca o input; leitores de tela anunciam o label).
  const autoId = useId();
  const inputId = id ?? autoId;
  const input = (
    <div className={styles.inputWrap}>
      {icon && <i className={`ti ti-${icon}`} aria-hidden />}
      {prefix && <span className={styles.prefix}>{prefix}</span>}
      <input id={inputId} {...rest} />
    </div>
  );

  if (!label && !hint) return input;

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      {label && (
        <label className={styles.fieldLabel} htmlFor={inputId}>
          {label}
        </label>
      )}
      {input}
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </div>
  );
}
