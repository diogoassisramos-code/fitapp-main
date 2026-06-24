import styles from "./ui.module.css";

export function Textarea({
  label,
  hint,
  id,
  maxLength,
  value,
  className,
  ...rest
}: {
  label?: string;
  hint?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const count =
    typeof value === "string" ? value.length : String(value ?? "").length;

  const area = (
    <textarea
      id={id}
      className={styles.textarea}
      maxLength={maxLength}
      value={value}
      {...rest}
    />
  );

  if (!label && !hint && maxLength === undefined) return area;

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      {label && (
        <label className={styles.fieldLabel} htmlFor={id}>
          {label}
        </label>
      )}
      {area}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        {hint ? (
          <span className={styles.fieldHint}>{hint}</span>
        ) : (
          <span />
        )}
        {maxLength !== undefined && (
          <span className={styles.counter}>
            {count}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
