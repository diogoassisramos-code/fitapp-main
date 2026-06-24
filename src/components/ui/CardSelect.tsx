"use client";

import styles from "./CardSelect.module.css";

export type CardOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon?: string;
};

export function CardSelect<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
}: {
  options: CardOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div
      className={styles.grid}
      style={{ "--cols": columns } as React.CSSProperties}
      role="radiogroup"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={styles.card}
          data-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon && (
            <span className={styles.icon}>
              <i className={`ti ti-${opt.icon}`} aria-hidden />
            </span>
          )}
          <span className={styles.label}>{opt.label}</span>
          {opt.description && (
            <span className={styles.desc}>{opt.description}</span>
          )}
          <span className={styles.check} aria-hidden>
            <i className="ti ti-check" />
          </span>
        </button>
      ))}
    </div>
  );
}
