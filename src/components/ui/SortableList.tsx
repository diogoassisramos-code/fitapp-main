"use client";

import { useState } from "react";
import styles from "./SortableList.module.css";

/**
 * Lista reordenável por arraste (HTML5 DnD, sem dependências).
 * Controlada: chama onReorder com o novo array já reordenado.
 * O `renderItem` deve incluir um elemento com a classe styles.handle
 * exposta via prop `handleClassName` para a alça visual.
 */
export function SortableList<T>({
  items,
  getKey,
  onReorder,
  renderItem,
}: {
  items: T[];
  getKey: (item: T, index: number) => string;
  onReorder: (next: T[]) => void;
  renderItem: (item: T, index: number, handleClassName: string) => React.ReactNode;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function move(from: number, to: number) {
    if (from === to) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  }

  return (
    <div className={styles.list}>
      {items.map((item, index) => (
        <div
          key={getKey(item, index)}
          className={styles.row}
          draggable
          data-dragging={dragIndex === index || undefined}
          data-over={overIndex === index && dragIndex !== index ? "true" : undefined}
          onDragStart={(e) => {
            setDragIndex(index);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIndex(index);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null) move(dragIndex, index);
            setDragIndex(null);
            setOverIndex(null);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
          }}
        >
          {renderItem(item, index, styles.handle)}
        </div>
      ))}
    </div>
  );
}
