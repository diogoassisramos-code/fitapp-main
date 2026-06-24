"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./KebabMenu.module.css";

export type MenuItem = {
  label: string;
  icon?: string;
  onClick?: () => void;
  danger?: boolean;
  separatorBefore?: boolean;
};

export function KebabMenu({
  items,
  label = "Mais ações",
  align = "right",
}: {
  items: MenuItem[];
  label?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <i className="ti ti-dots-vertical" aria-hidden />
      </button>

      {open && (
        <div className={styles.menu} data-align={align} role="menu">
          {items.map((item, i) => (
            <div key={i}>
              {item.separatorBefore && <div className={styles.sep} />}
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                data-danger={item.danger || undefined}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.icon && <i className={`ti ti-${item.icon}`} aria-hidden />}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
