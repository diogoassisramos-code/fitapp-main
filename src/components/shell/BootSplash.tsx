import styles from "./BootSplash.module.css";

/** Splash de carregamento global com a marca Revo — enquanto a sessão/os dados
 *  iniciais ainda não resolveram (evita flash de tela em branco/mock). */
export function BootSplash() {
  return (
    <div className={styles.splash} role="status" aria-live="polite" aria-label="Carregando">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/revo-logo.svg" alt="Revo" className={styles.logo} />
      <span className={styles.bar} aria-hidden />
    </div>
  );
}
