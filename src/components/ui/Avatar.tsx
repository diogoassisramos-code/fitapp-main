import styles from "./ui.module.css";

/** Deriva iniciais de um nome: "Ana Paula Souza" -> "AP". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  size = 38,
}: {
  name: string;
  size?: number;
}) {
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size <= 32 ? 12 : 13 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
