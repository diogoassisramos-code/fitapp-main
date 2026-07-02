"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AdminShell } from "@/components/admin/AdminShell";
import { AlunoShell } from "@/components/aluno/AlunoShell";
import { isAuthed, isPublicPath } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/client";
import styles from "./AppShell.module.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Rotas de auth (login/cadastro/recuperar-senha) ocupam a tela inteira.
  const fullscreen = isPublicPath(pathname);

  // Gate de sessão: sem login, a primeira tela é sempre /login.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (fullscreen) {
      setReady(true);
      return;
    }
    // Modo protótipo (sem Supabase): flag localStorage.
    if (!supabaseEnabled) {
      if (!isAuthed()) {
        setReady(false);
        router.replace("/login");
        return;
      }
      setReady(true);
      return;
    }
    // Modo Supabase: sessão real + redireciona no logout.
    const supabase = createClient();
    let active = true;
    let settled = false;
    // Se a sessão não resolver em 6s (Supabase dormindo/cold-start/522),
    // renderiza o chrome em vez de ficar em branco; os dados carregam quando
    // o Supabase voltar (ou o onAuthStateChange corrige).
    const fallbackTimer = setTimeout(() => {
      if (active && !settled) {
        settled = true;
        setReady(true);
      }
    }, 6000);
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active || settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        if (!data.session) {
          setReady(false);
          router.replace("/login");
        } else {
          setReady(true);
        }
      })
      .catch(() => {
        // Supabase indisponível: não deixa a rejeição virar overlay e renderiza.
        if (active && !settled) {
          settled = true;
          clearTimeout(fallbackTimer);
          setReady(true);
        }
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        setReady(false);
        router.replace("/login");
      } else {
        setReady(true);
      }
    });
    return () => {
      active = false;
      clearTimeout(fallbackTimer);
      sub.subscription.unsubscribe();
    };
  }, [pathname, fullscreen, router]);

  if (fullscreen) {
    return <>{children}</>;
  }

  // Enquanto a sessão não é confirmada, não renderiza conteúdo protegido
  // (evita flash do dashboard antes do redirect pro login).
  if (!ready) {
    return null;
  }

  // Área administrativa da plataforma usa um shell próprio (escuro).
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return <AdminShell>{children}</AdminShell>;
  }

  // Área do aluno (mobile) usa moldura própria, sem a sidebar do consultor.
  if (pathname === "/aluno" || pathname.startsWith("/aluno/")) {
    return <AlunoShell>{children}</AlunoShell>;
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
