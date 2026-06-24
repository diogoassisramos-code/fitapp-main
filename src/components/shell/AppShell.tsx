"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AdminShell } from "@/components/admin/AdminShell";
import styles from "./AppShell.module.css";

/** Rotas sem o shell do dashboard (auth ocupa a tela inteira). */
const FULLSCREEN_PREFIXES = ["/login", "/cadastro", "/recuperar-senha"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const fullscreen = FULLSCREEN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (fullscreen) {
    return <>{children}</>;
  }

  // Área administrativa da plataforma usa um shell próprio (escuro).
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return <AdminShell>{children}</AdminShell>;
  }

  return (
    <div className={styles.shell} data-mobile-open={mobileOpen}>
      <Sidebar
        open={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Overlay para fechar o menu no mobile */}
      <div
        className={styles.overlay}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      <div className={styles.main}>
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
