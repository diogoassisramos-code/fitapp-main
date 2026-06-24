"use client";

import { COACH } from "@/lib/nav";
import { brl } from "@/lib/format";
import styles from "./Topbar.module.css";

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  return (
    <header className={styles.topbar}>
      <button
        type="button"
        className={styles.menuBtn}
        onClick={onOpenMobile}
        aria-label="Abrir menu"
      >
        <i className="ti ti-menu-2" aria-hidden />
      </button>

      {/* Busca global */}
      <label className={styles.search}>
        <i className="ti ti-search" aria-hidden />
        <input
          type="search"
          placeholder="Buscar alunos, planos, pagamentos…"
          aria-label="Busca global"
        />
        <kbd className={styles.kbd}>/</kbd>
      </label>

      <div className={styles.right}>
        {/* Saldo */}
        <div className={styles.saldo}>
          <span className={styles.saldoLabel}>Saldo</span>
          <span className={styles.saldoValue}>{brl(COACH.saldo)}</span>
        </div>

        {/* Sino */}
        <button type="button" className={styles.bell} aria-label="Notificações">
          <i className="ti ti-bell" aria-hidden />
          <span className={styles.dot} aria-hidden />
        </button>
      </div>
    </header>
  );
}
