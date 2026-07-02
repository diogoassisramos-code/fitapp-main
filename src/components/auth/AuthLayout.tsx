import Link from "next/link";
import styles from "./AuthLayout.module.css";

const FEATURES = [
  { icon: "barbell", text: "Treinos, dietas e protocolos personalizados" },
  { icon: "checkup-list", text: "Check-ins semanais com fotos e evolução" },
  { icon: "credit-card", text: "Planos, link de pagamento e financeiro" },
];

/**
 * Layout das telas de autenticação (login / cadastro).
 * Painel de marca à esquerda (desktop) + slot de conteúdo à direita.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.wrap}>
      <aside className={styles.brand}>
        <Link href="/" className={styles.logo}>
          <img
            src="/revo-logo.svg"
            alt="Revo"
            className={`${styles.wordmark} ${styles.wordmarkLight}`}
          />
        </Link>

        <div className={styles.brandBody}>
          <h2 className={styles.brandTitle}>
            O cockpit da sua consultoria fitness.
          </h2>
          <p className={styles.brandSub}>
            Gerencie alunos, monte protocolos e receba pagamentos — tudo num só
            lugar.
          </p>

          <ul className={styles.features}>
            {FEATURES.map((f) => (
              <li key={f.icon} className={styles.feature}>
                <span className={styles.featureIcon}>
                  <i className={`ti ti-${f.icon}`} aria-hidden />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className={styles.brandFoot}>Revo · Dashboard do consultor</p>
      </aside>

      <main className={styles.panel}>
        {/* Logo compacto para mobile (painel de marca fica escondido) */}
        <Link href="/" className={styles.logoMobile}>
          <img src="/revo-logo.svg" alt="Revo" className={styles.wordmark} />
        </Link>

        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
