// ============================================================================
// /api/configuracoes — lê e salva as Configurações da consultoria do consultor
// logado. GET carrega os dados reais; POST salva um patch (por seção). Escrita
// via service_role (uniformiza telefone/checkout_cor, que ficam fora do grant
// direto), sempre restrita à consultoria do próprio consultor.
// ============================================================================
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Colunas da consultoria que o consultor pode editar nas Configurações.
const CAMPOS = [
  "nome_negocio",
  "bio",
  "especialidade",
  "conselho_tipo",
  "conselho_numero",
  "telefone",
  "documento",
  "saque_pix",
  "saque_banco",
  "saque_agencia",
  "saque_conta",
  "notif_novo_pagamento",
  "notif_checkin_recebido",
  "notif_pagamento_atrasado",
  "notif_novo_aluno",
] as const;

async function resolverConsultor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "não autenticado" as const, status: 401 };
  const { data: prof } = await supabase
    .from("profiles")
    .select("role, consultoria_id, nome")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "consultor" || !prof.consultoria_id) {
    return { erro: "apenas consultor" as const, status: 403 };
  }
  return { user, consultoriaId: prof.consultoria_id as string, profileNome: prof.nome as string | null };
}

export async function GET() {
  const r = await resolverConsultor();
  if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: r.status });

  const admin = createAdminClient();
  const { data: cons } = await admin
    .from("consultorias")
    .select("*")
    .eq("id", r.consultoriaId)
    .maybeSingle();
  const c = (cons ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    ok: true,
    email: r.user.email ?? "",
    nome: r.profileNome || (c.nome as string) || "",
    nome_negocio: c.nome_negocio ?? "",
    bio: c.bio ?? "",
    especialidade: c.especialidade ?? "",
    conselho_tipo: c.conselho_tipo ?? "CREF",
    conselho_numero: c.conselho_numero ?? "",
    telefone: c.telefone ?? "",
    documento: c.documento ?? "",
    saque_pix: c.saque_pix ?? "",
    saque_banco: c.saque_banco ?? "",
    saque_agencia: c.saque_agencia ?? "",
    saque_conta: c.saque_conta ?? "",
    checkout_cor: c.checkout_cor ?? "",
    notif_novo_pagamento: c.notif_novo_pagamento ?? true,
    notif_checkin_recebido: c.notif_checkin_recebido ?? true,
    notif_pagamento_atrasado: c.notif_pagamento_atrasado ?? true,
    notif_novo_aluno: c.notif_novo_aluno ?? true,
  });
}

export async function POST(request: Request) {
  const r = await resolverConsultor();
  if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: r.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const campo of CAMPOS) {
    if (campo in body) {
      // Strings vazias em campos opcionais viram null (evita "" onde faz sentido nulo).
      const v = body[campo];
      patch[campo] =
        typeof v === "string" && v.trim() === "" &&
        (campo === "conselho_tipo" || campo === "conselho_numero" || campo === "documento")
          ? null
          : v;
    }
  }

  const admin = createAdminClient();

  // Nome do profissional: mora em profiles.nome (identidade exibida) e também na
  // consultoria (fallback). Atualiza os dois quando enviado.
  if (typeof body.nome === "string" && body.nome.trim()) {
    const nome = body.nome.trim();
    patch.nome = nome;
    await admin.from("profiles").update({ nome }).eq("id", r.user.id);
  }

  // checkout_cor pode não existir se schema_config.sql não rodou → best-effort.
  const temCheckout = typeof body.checkout_cor === "string";

  try {
    if (Object.keys(patch).length > 0) {
      const up = await admin.from("consultorias").update(patch).eq("id", r.consultoriaId);
      if (up.error) throw up.error;
    }
    if (temCheckout) {
      const { error } = await admin
        .from("consultorias")
        .update({ checkout_cor: body.checkout_cor })
        .eq("id", r.consultoriaId);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[configuracoes] checkout_cor não salvo (rode schema_config.sql):", error.message);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[configuracoes POST] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao salvar" },
      { status: 500 }
    );
  }
}
