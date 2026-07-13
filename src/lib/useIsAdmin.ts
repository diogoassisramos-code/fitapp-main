"use client";

import { useEffect, useState } from "react";
import { supabaseEnabled } from "./supabaseEnabled";
import { createClient } from "@/utils/supabase/client";
import { isAdminEmail } from "./adminAccess";

/**
 * true só quando o usuário logado é admin da allowlist (por e-mail). Usado para
 * mostrar o botão "Painel admin" apenas para ele. É afeto de UX — o acesso de
 * fato é barrado no middleware e nas rotas /api/admin/*. Em protótipo (sem
 * Supabase) retorna false: sem e-mail real, esconde o botão.
 */
export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!supabaseEnabled) return;
    let active = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setAdmin(isAdminEmail(data.user?.email));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return admin;
}
