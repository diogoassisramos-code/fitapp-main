"use client";

import styles from "./Tabs.module.css";

export type TabItem = {
  id: string;
  label: string;
  icon?: string;
};

export function Tabs({
  items,
  active,
  onChange,
  orientation = "horizontal",
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      className={styles.tabs}
      data-orientation={orientation}
      role="tablist"
      aria-orientation={orientation}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={styles.tab}
          data-active={active === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.icon && <i className={`ti ti-${item.icon}`} aria-hidden />}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
