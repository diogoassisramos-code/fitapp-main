"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, COACH } from "@/lib/nav";
import { signOut } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/client";
import styles from "./Sidebar.module.css";

function sair() {
  if (supabaseEnabled) createClient().auth.signOut();
  else signOut();
}

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({
  open,
  onCloseMobile,
}: {
  open: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar} data-open={open}>
      {/* Logo */}
      <div className={styles.head}>
        <Link href="/" className={styles.logo} onClick={onCloseMobile}>
          <span className={styles.logoMark}>
            <i className="ti ti-barbell" aria-hidden />
          </span>
          <span className={styles.label}>CoachFit</span>
        </Link>
      </div>

      {/* Navegação */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={styles.navItem}
              data-active={active}
              onClick={onCloseMobile}
            >
              <i className={`ti ti-${item.icon}`} aria-hidden />
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Acesso ao painel administrativo da plataforma */}
      <Link href="/admin" className={styles.navItem} onClick={onCloseMobile}>
        <i className="ti ti-shield-cog" aria-hidden />
        <span className={styles.label}>Painel admin</span>
      </Link>

      {/* Card do usuário no rodapé */}
      <div className={styles.userRow}>
        <Link
          href="/configuracoes"
          className={styles.userCard}
          onClick={onCloseMobile}
        >
          <span className={styles.avatar}>{COACH.iniciais}</span>
          <span className={`${styles.userMeta} ${styles.label}`}>
            <span className={styles.userName}>{COACH.nome}</span>
            <span className={styles.userConselho}>{COACH.conselho}</span>
          </span>
        </Link>
        <Link
          href="/login"
          className={`${styles.logout} ${styles.label}`}
          onClick={() => {
            sair();
            onCloseMobile();
          }}
          title="Sair"
          aria-label="Sair"
        >
          <i className="ti ti-logout" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
