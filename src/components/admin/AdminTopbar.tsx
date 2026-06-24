"use client";

import { brl } from "@/lib/format";
import { adminFinanceiro } from "@/lib/admin";
import styles from "./AdminTopbar.module.css";

export function AdminTopbar({ onOpenMobile }: { onOpenMobile: () => void }) {
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

      <label className={styles.search}>
        <i className="ti ti-search" aria-hidden />
        <input
          type="search"
          placeholder="Buscar consultorias, alunos, assinaturas…"
          aria-label="Busca da plataforma"
        />
      </label>

      <div className={styles.right}>
        <div className={styles.mrr}>
          <span className={styles.mrrLabel}>MRR</span>
          <span className={styles.mrrValue}>{brl(adminFinanceiro.mrrPlataforma)}</span>
        </div>
        <button type="button" className={styles.bell} aria-label="Notificações">
          <i className="ti ti-bell" aria-hidden />
        </button>
      </div>
    </header>
  );
}
