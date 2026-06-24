import styles from "./ui.module.css";

export function SectionBlock({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <span className={styles.sectionNum}>{number}</span>
      <div className={styles.sectionBody}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>{title}</h3>
          {description && <p className={styles.sectionDesc}>{description}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
