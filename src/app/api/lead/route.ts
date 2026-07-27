// ============================================================================
// POST /api/lead — captura de LEAD de marketing (público, sem auth). Guarda o
// e-mail informado no cadastro mesmo se a pessoa abandonar antes de criar a
// conta. NÃO é conta: não tem senha e não bloqueia um signup futuro naquele
// e-mail. Escreve via service_role (a tabela leads é fechada por RLS).
//
// Nunca trava o funil: qualquer erro (tabela ausente, etc.) responde ok.
// ============================================================================
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    nome?: string;
    cpf?: string;
    telefone?: string;
    plano?: string;
    virouConta?: boolean;
    aceite?: boolean;
  };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/.+@.+\..+/.test(email)) {
    return NextResponse.json({ erro: "e-mail inválido" }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    email,
    updated_at: new Date().toISOString(),
  };
  if (body.nome?.trim()) row.nome = body.nome.trim();
  if (body.cpf) row.cpf = String(body.cpf).replace(/\D/g, "") || null;
  if (body.telefone) row.telefone = String(body.telefone).replace(/\D/g, "") || null;
  if (body.plano) row.plano = body.plano;
  if (body.virouConta) row.virou_conta = true;
  if (body.aceite) {
    row.aceite_termos = true;
    row.aceite_em = new Date().toISOString();
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("leads").upsert(row, { onConflict: "email" });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[lead] não gravado (rode schema_leads.sql?):", error.message);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[lead] erro:", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true });
}
