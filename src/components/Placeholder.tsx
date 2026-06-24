import { Button } from "@/components/ui";
import styles from "./Placeholder.module.css";

export function Placeholder({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.wrap}>
      <span className={styles.icon}>
        <i className={`ti ti-${icon}`} aria-hidden />
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.desc}>{description}</p>
      <span className={styles.tag}>Em breve</span>
      <div className={styles.action}>
        <Button href="/styleguide" variant="outline" icon="components">
          Ver biblioteca de componentes
        </Button>
      </div>
    </div>
  );
}
