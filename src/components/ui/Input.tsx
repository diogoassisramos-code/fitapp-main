"use client";

import { useId, useState } from "react";
import styles from "./ui.module.css";

export function Input({
  label,
  hint,
  icon,
  prefix,
  id,
  className,
  type,
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
  // Campos de senha ganham um botão "mostrar/ocultar" (olho) automaticamente.
  const isPassword = type === "password";
  const [mostrar, setMostrar] = useState(false);
  const tipoEfetivo = isPassword ? (mostrar ? "text" : "password") : type;
  const input = (
    <div className={styles.inputWrap}>
      {icon && <i className={`ti ti-${icon}`} aria-hidden />}
      {prefix && <span className={styles.prefix}>{prefix}</span>}
      <input id={inputId} type={tipoEfetivo} {...rest} />
      {isPassword && (
        <button
          type="button"
          className={styles.inputEye}
          onClick={() => setMostrar((m) => !m)}
          aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
          tabIndex={-1}
        >
          <i className={`ti ti-${mostrar ? "eye-off" : "eye"}`} aria-hidden />
        </button>
      )}
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
