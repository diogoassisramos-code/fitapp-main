"use client";

import { useEffect, useState } from "react";
import { brl } from "@/lib/format";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { adminFinanceiro } from "@/lib/admin";
import { adminFetchStats } from "@/lib/adminDb";
import styles from "./AdminTopbar.module.css";

export function AdminTopbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  // MRR real da plataforma (sessão admin); cai no mock só sem Supabase.
  const [mrr, setMrr] = useState<number | null>(
    supabaseEnabled ? null : adminFinanceiro.mrrPlataforma
  );
  useEffect(() => {
    if (!supabaseEnabled) return;
    let active = true;
    adminFetchStats()
      .then((s) => active && setMrr(s.mrrPlataforma))
      .catch(() => active && setMrr(0));
    return () => {
      active = false;
    };
  }, []);

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
          <span className={styles.mrrValue}>{mrr == null ? "—" : brl(mrr)}</span>
        </div>
        <button type="button" className={styles.bell} aria-label="Notificações">
          <i className="ti ti-bell" aria-hidden />
        </button>
      </div>
    </header>
  );
}
