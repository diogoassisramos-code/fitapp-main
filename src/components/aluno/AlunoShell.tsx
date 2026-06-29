"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/client";
import styles from "./AlunoShell.module.css";

/**
 * Moldura mobile da área do ALUNO (fullscreen, sem a sidebar do consultor).
 * Coluna central estilo app, com app bar simples (marca + sair).
 */
export function AlunoShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function sair() {
    if (supabaseEnabled) {
      try {
        await createClient().auth.signOut();
      } catch {
        /* ignore */
      }
    }
    signOut();
    router.replace("/login");
  }

  return (
    <div className={styles.canvas}>
      <div className={styles.phone}>
        <header className={styles.bar}>
          <span className={styles.brand}>
            <i className="ti ti-barbell" aria-hidden />
            CoachFit
          </span>
          <button type="button" className={styles.sair} onClick={sair}>
            <i className="ti ti-logout" aria-hidden />
            Sair
          </button>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
