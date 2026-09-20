// ============================================================================
// GET /api/admin/consultorias/[id]/recebimentos — visão do ADMIN sobre o lado
// financeiro de UMA consultoria: subconta no gateway (saldo disponível,
// verificação/KYC real, pendências), taxa da plataforma retida, GMV, alunos em
// atraso e a assinatura SaaS como está no gateway (valor real, próxima cobrança).
//
// Admin-only. Lê o banco com service role e o gateway com a apiKey da subconta
// (status/saldo/documentos) e a chave master (assinatura SaaS). Cada consulta ao
// gateway é isolada: se uma falhar, o resto da resposta continua vindo.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { guardAdmin } from "@/lib/apiAdmin";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  statusSubconta,
  saldoSubconta,
  listarDocumentosSubconta,
  onboardingUrlDosDocumentos,
  getAssinatura,
} from "@/lib/asaas";
import { fetchPlanoSaaS } from "@/lib/planosPlataforma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGO = ["CONFIRMED", "RECEIVED"];

export type RecebimentosConsultoria = {
  ok: true;
  /** Subconta de recebimento do coach no gateway. */
  subconta: {
    criada: boolean;
    walletId: string | null;
    /** Status registrado no nosso banco (pode estar "aprovado" por bypass de dev). */
    statusLocal: string;
    /** Verificação REAL no gateway. */
    verificacao: "aprovada" | "pendente" | "reprovada" | "desconhecida";
    detalhes: { comercial?: string; bancario?: string; documentacao?: string; geral?: string };
    pendencias: { tipo: string; titulo: string; status: string }[];
    onboardingUrl: string | null;
    /** Saldo DISPONÍVEL na subconta (R$) — null se não deu pra consultar. */
    saldo: number | null;
  };
  /** Fatia da plataforma sobre as mensalidades desse coach. */
  taxa: { pct: number; retidaTotal: number; retidaMes: number };
  /** Mensalidades dos alunos (bruto). */
  gmv: { total: number; mes: number; cobrancasPagas: number };
  /** Inadimplência dos alunos desse coach. */
  atrasos: { alunos: number; cobrancasVencidas: number; valorVencido: number };
  /** Assinatura SaaS do coach como está no gateway. */
  assinatura: {
    existe: boolean;
    id: string | null;
    plano: string;
    precoTabela: number;
    valorGateway: number | null;
    status: string | null;
    proximaCobranca: string | null;
    ciclo: string | null;
  };
};

function ymd(v: unknown): string {
  return typeof v === "string" ? v.slice(0, 10) : "";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const negado = await guardAdmin();
  if (negado) return negado;
  const { id } = await ctx.params;

  const admin = createAdminClient();
  const { data: cons } = await admin
    .from("consultorias")
    .select(
      "id, plano, plano_status, asaas_subaccount_key, asaas_wallet_id, asaas_onboarding_status, asaas_subscription_id, taxa_plataforma_pct"
    )
    .eq("id", id)
    .maybeSingle();
  if (!cons) return NextResponse.json({ erro: "consultoria não encontrada" }, { status: 404 });

  const mesAtual = new Date().toISOString().slice(0, 7);

  // ── Banco: pagamentos + alunos + taxa global + plano ──────────────────────
  const [pagRes, alunosRes, cfgRes, plano] = await Promise.all([
    admin
      .from("pagamentos")
      .select("fluxo, status, valor, split_taxa, recebido_em, confirmado_em, criado_em")
      .eq("consultoria_id", id),
    admin.from("alunos").select("id, status_pagamento").eq("consultoria_id", id),
    admin.from("plataforma_config").select("taxa_plataforma_pct").eq("id", 1).maybeSingle(),
    fetchPlanoSaaS(admin, cons.plano ?? "free"),
  ]);

  type Pag = {
    fluxo: string | null;
    status: string | null;
    valor: number | null;
    split_taxa: number | null;
    recebido_em: string | null;
    confirmado_em: string | null;
    criado_em: string | null;
  };
  const pags = (pagRes.data ?? []) as Pag[];
  const mensalidades = pags.filter((p) => p.fluxo === "mensalidade");
  const quando = (p: Pag) => ymd(p.recebido_em ?? p.confirmado_em ?? p.criado_em);
  let retidaTotal = 0;
  let retidaMes = 0;
  let gmvTotal = 0;
  let gmvMes = 0;
  let pagas = 0;
  let vencidas = 0;
  let valorVencido = 0;
  for (const p of mensalidades) {
    const st = String(p.status ?? "").toUpperCase();
    if (PAGO.includes(st)) {
      pagas++;
      const bruto = Number(p.valor ?? 0);
      const taxa = Number(p.split_taxa ?? 0);
      gmvTotal += bruto;
      retidaTotal += taxa;
      if (quando(p).slice(0, 7) === mesAtual) {
        gmvMes += bruto;
        retidaMes += taxa;
      }
    } else if (st === "OVERDUE") {
      vencidas++;
      valorVencido += Number(p.valor ?? 0);
    }
  }
  const alunosAtrasados = (alunosRes.data ?? []).filter(
    (a) => a.status_pagamento === "atrasado"
  ).length;
  const taxaPct =
    cons.taxa_plataforma_pct != null
      ? Number(cons.taxa_plataforma_pct)
      : Number(cfgRes.data?.taxa_plataforma_pct ?? 10);

  // ── Gateway: subconta (apiKey dela) + assinatura SaaS (chave master) ──────
  const sub: RecebimentosConsultoria["subconta"] = {
    criada: !!cons.asaas_wallet_id,
    walletId: cons.asaas_wallet_id ?? null,
    statusLocal: cons.asaas_onboarding_status ?? "nao_iniciado",
    verificacao: "desconhecida",
    detalhes: {},
    pendencias: [],
    onboardingUrl: null,
    saldo: null,
  };
  const assinatura: RecebimentosConsultoria["assinatura"] = {
    existe: !!cons.asaas_subscription_id,
    id: cons.asaas_subscription_id ?? null,
    plano: cons.plano ?? "free",
    precoTabela: plano?.preco ?? 0,
    valorGateway: null,
    status: null,
    proximaCobranca: null,
    ciclo: null,
  };

  if (asaasEnabled) {
    const key = cons.asaas_subaccount_key as string | null;
    const tarefas: Promise<void>[] = [];
    if (key) {
      tarefas.push(
        statusSubconta(key)
          .then((st) => {
            sub.detalhes = {
              comercial: st.commercialInfo,
              bancario: st.bankAccountInfo,
              documentacao: st.documentation,
              geral: st.general,
            };
            const g = String(st.general ?? "").toUpperCase();
            sub.verificacao =
              g === "APPROVED"
                ? "aprovada"
                : g === "REJECTED"
                  ? "reprovada"
                  : g
                    ? "pendente"
                    : "desconhecida";
          })
          .catch(() => {}),
        saldoSubconta(key)
          .then((s) => {
            sub.saldo = Number(s.balance ?? 0);
          })
          .catch(() => {}),
        listarDocumentosSubconta(key)
          .then((d) => {
            sub.pendencias = (d.data ?? [])
              .filter((x) => String(x.status).toUpperCase() !== "APPROVED")
              .map((x) => ({ tipo: x.type, titulo: x.title ?? x.type, status: x.status }));
            sub.onboardingUrl = onboardingUrlDosDocumentos(d) ?? null;
          })
          .catch(() => {})
      );
    }
    if (cons.asaas_subscription_id) {
      tarefas.push(
        getAssinatura(cons.asaas_subscription_id as string)
          .then((a) => {
            assinatura.valorGateway = Number(a.value ?? 0);
            assinatura.status = a.status ?? null;
            assinatura.proximaCobranca = a.nextDueDate ?? null;
            assinatura.ciclo = a.cycle ?? null;
          })
          .catch(() => {})
      );
    }
    await Promise.all(tarefas);
  }

  const resposta: RecebimentosConsultoria = {
    ok: true,
    subconta: sub,
    taxa: { pct: taxaPct, retidaTotal, retidaMes },
    gmv: { total: gmvTotal, mes: gmvMes, cobrancasPagas: pagas },
    atrasos: { alunos: alunosAtrasados, cobrancasVencidas: vencidas, valorVencido },
    assinatura,
  };
  return NextResponse.json(resposta);
}
