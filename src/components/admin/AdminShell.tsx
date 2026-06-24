"use client";

import { useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import styles from "./AdminShell.module.css";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={styles.shell} data-mobile-open={mobileOpen}>
      <AdminSidebar open={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div
        className={styles.overlay}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      <div className={styles.main}>
        <AdminTopbar onOpenMobile={() => setMobileOpen(true)} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
