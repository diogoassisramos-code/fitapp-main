"use client";

import { useEffect, useState } from "react";
import { COACH } from "@/lib/nav";
import { brl } from "@/lib/format";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { fetchConsultoriaResumo } from "@/lib/db";
import styles from "./Topbar.module.css";

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  // Saldo real: no modo Supabase, o valor ao vivo da subconta no Asaas (mesmo do
  // card "Saldo disponível"); no protótipo, o mock. null = ainda carregando.
  const [saldo, setSaldo] = useState<number | null>(
    supabaseEnabled ? null : COACH.saldo
  );

  useEffect(() => {
    if (!supabaseEnabled) return;
    let active = true;
    (async () => {
      // 1) Saldo DISPONÍVEL ao vivo da subconta (o split cai direto na wallet).
      try {
        const r = await fetch("/api/asaas/saldo");
        const d = await r.json().catch(() => ({}));
        if (active && d?.ok) {
          setSaldo(Number(d.saldo));
          return;
        }
      } catch {
        /* sem subconta / Asaas indisponível → cai no saldo do banco */
      }
      // 2) Fallback: saldo persistido na consultoria (0 em conta nova).
      try {
        const c = await fetchConsultoriaResumo();
        if (active) setSaldo(c.saldo);
      } catch {
        if (active) setSaldo(0);
      }
    })();
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
          <span className={styles.saldoValue}>
            {saldo == null ? "R$ —" : brl(saldo)}
          </span>
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
