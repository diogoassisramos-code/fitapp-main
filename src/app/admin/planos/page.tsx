"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  MetricCard,
  StatusBadge,
  KebabMenu,
  Input,
  Textarea,
  Modal,
  Toggle,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { brl } from "@/lib/format";
import {
  adminFetchPlanosPlataforma,
  adminSavePlanoPlataforma,
  adminDeletePlanoPlataforma,
  type PlanoPlataforma,
} from "@/lib/adminDb";
import { propagarPrecoPlano } from "@/lib/adminAsaas";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import styles from "./planos.module.css";

type FormState = { slug: string; nome: string; preco: string; limite: string; descricao: string };
const FORM_VAZIO: FormState = { slug: "", nome: "", preco: "", limite: "", descricao: "" };

export default function AdminPlanosPage() {
  const [planos, setPlanos] = useState<PlanoPlataforma[] | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [editar, setEditar] = useState<PlanoPlataforma | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Ao mudar o preço: aplicar também nas assinaturas já ativas desse plano no gateway.
  const [aplicarAssinaturas, setAplicarAssinaturas] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = () => adminFetchPlanosPlataforma().then(setPlanos).catch(() => setPlanos([]));
  useEffect(() => {
    carregar();
  }, []);

  const todos = planos ?? [];
  const mrr = todos.reduce((s, p) => s + p.preco * p.assinantes, 0);
  const planosAtivos = todos.filter((p) => p.status === "ativo").length;
  const assinantesTotais = todos.reduce((s, p) => s + p.assinantes, 0);

  function abrirCriar() {
    setEditar(null);
    setErro(null);
    setForm(FORM_VAZIO);
    setModalAberto(true);
  }

  function abrirEditar(p: PlanoPlataforma) {
    setEditar(p);
    setErro(null);
    setForm({ slug: p.slug, nome: p.nome, preco: String(p.preco), limite: String(p.limiteAlunos), descricao: p.descricao });
    setAplicarAssinaturas(true);
    setModalAberto(true);
  }

  async function salvar() {
    setErro(null);
    const slug = form.slug.trim().toLowerCase();
    if (!form.nome.trim()) return setErro("Informe o nome.");
    if (!slug) return setErro("Informe o identificador (slug).");
    setSalvando(true);
    setAviso(null);
    const precoNovo = Number(form.preco.replace(",", ".")) || 0;
    const precoMudou = !!editar && precoNovo !== editar.preco;
    try {
      await adminSavePlanoPlataforma(
        {
          slug,
          nome: form.nome.trim(),
          descricao: form.descricao.trim(),
          preco: precoNovo,
          limiteAlunos: Number(form.limite) || 0,
          recursos: editar?.recursos ?? [],
          destaque: editar?.destaque ?? false,
          status: editar?.status ?? "ativo",
          ordem: editar?.ordem ?? todos.length,
        },
        editar?.id
      );
      // Preço mudou → propaga às assinaturas ativas no gateway (só próximas cobranças).
      if (precoMudou && aplicarAssinaturas && supabaseEnabled) {
        try {
          const r = await propagarPrecoPlano(slug);
          setAviso(
            r.total === 0
              ? "Preço salvo. Nenhuma assinatura ativa neste plano para atualizar."
              : r.falhas.length === 0
                ? `Preço salvo e aplicado em ${r.atualizadas} assinatura(s). Vale a partir da próxima cobrança.`
                : `Preço salvo; ${r.atualizadas}/${r.total} assinatura(s) atualizada(s) — ${r.falhas.length} falhou(aram). Tente de novo mais tarde.`
          );
        } catch (e) {
          setAviso(
            `Preço salvo, mas não consegui aplicar nas assinaturas ativas (${e instanceof Error ? e.message : "falha"}). Novas assinaturas já usam o valor novo.`
          );
        }
      } else if (precoMudou && !aplicarAssinaturas) {
        setAviso("Preço salvo. As assinaturas ativas mantêm o valor antigo; só novas usam o novo.");
      }
      setModalAberto(false);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarArquivar(p: PlanoPlataforma) {
    try {
      await adminSavePlanoPlataforma(
        {
          slug: p.slug,
          nome: p.nome,
          descricao: p.descricao,
          preco: p.preco,
          limiteAlunos: p.limiteAlunos,
          recursos: p.recursos,
          destaque: p.destaque,
          status: p.status === "arquivado" ? "ativo" : "arquivado",
          ordem: p.ordem,
        },
        p.id
      );
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao arquivar.");
    }
  }

  async function excluir(p: PlanoPlataforma) {
    if (p.assinantes > 0) {
      alert(`Este plano tem ${p.assinantes} consultoria(s) assinando. Arquive em vez de excluir.`);
      return;
    }
    if (!confirm(`Excluir o plano "${p.nome}"? Ação irreversível.`)) return;
    try {
      await adminDeletePlanoPlataforma(p.id);
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir.");
    }
  }

  return (
    <>
      <PageHeader
        title="Planos da plataforma"
        subtitle="Planos de assinatura que as consultorias contratam"
        actions={
          <Button icon="plus" onClick={abrirCriar}>
            Criar plano
          </Button>
        }
      />

      {aviso && (
        <p className={styles.aviso} role="status">
          <i className="ti ti-info-circle" aria-hidden /> {aviso}
          <button type="button" className={styles.avisoFechar} onClick={() => setAviso(null)} aria-label="Fechar">
            <i className="ti ti-x" aria-hidden />
          </button>
        </p>
      )}
      <div className={styles.metrics}>
        <MetricCard label="MRR dos planos" value={brl(mrr)} sub="Receita recorrente mensal" icon="currency-real" />
        <MetricCard label="Planos ativos" value={planosAtivos} sub={`${todos.length} planos no total`} icon="layout-grid" />
        <MetricCard label="Assinantes totais" value={assinantesTotais} sub="Consultorias assinando" icon="building-store" />
      </div>

      <div className={styles.grid}>
        {todos.map((plano) => {
          const arquivado = plano.status === "arquivado";
          const gerado = plano.preco * plano.assinantes;
          return (
            <Card key={plano.id} className={[styles.plano, plano.destaque ? styles.destaque : "", arquivado ? styles.arquivado : ""].filter(Boolean).join(" ")}>
              <CardBody className={styles.planoBody}>
                <div className={styles.planoTop}>
                  <div className={styles.tituloLinha}>
                    <h3 className={styles.planoNome}>{plano.nome}</h3>
                    {plano.destaque && (
                      <span className={styles.popular}>
                        <i className="ti ti-star-filled" aria-hidden /> Mais popular
                      </span>
                    )}
                    {arquivado && <StatusBadge variant="off" noDot>Arquivado</StatusBadge>}
                  </div>
                  <div className={styles.precoLinha}>
                    <span className={styles.preco}>{brl(plano.preco)}</span>
                    <span className={styles.precoUnidade}>/mês</span>
                  </div>
                  <p className={styles.descricao}>{plano.descricao}</p>
                </div>

                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}><i className="ti ti-building" aria-hidden /> Clientes</span>
                    <span className={styles.statValue}>{plano.assinantes}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}><i className="ti ti-trending-up" aria-hidden /> Gera</span>
                    <span className={styles.statValue} data-receita>{brl(gerado)}<span className={styles.statUnidade}>/mês</span></span>
                  </div>
                </div>

                <div className={styles.entregas}>
                  <span className={styles.entregasTitulo}>Entregas do plano</span>
                  <div className={styles.limite}>
                    <i className="ti ti-users" aria-hidden />
                    {plano.limiteAlunos === 0 ? "Alunos ilimitados" : `Até ${plano.limiteAlunos} alunos`}
                  </div>
                  <ul className={styles.recursos}>
                    {plano.recursos.length === 0 ? (
                      <li className={styles.recursoVazio}>Nenhuma entrega definida ainda.</li>
                    ) : (
                      plano.recursos.map((r) => (
                        <li key={r} className={styles.recurso}>
                          <i className="ti ti-circle-check-filled" aria-hidden />
                          <span>{r}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div className={styles.rodape}>
                  <Button variant="outline" size="sm" icon="pencil" onClick={() => abrirEditar(plano)}>
                    Editar nome e preço
                  </Button>
                  <KebabMenu
                    items={[
                      { label: "Editar", icon: "pencil", onClick: () => abrirEditar(plano) },
                      { label: arquivado ? "Reativar" : "Arquivar", icon: arquivado ? "archive-off" : "archive", onClick: () => alternarArquivar(plano) },
                      { label: "Excluir", icon: "trash", danger: true, separatorBefore: true, onClick: () => excluir(plano) },
                    ]}
                  />
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Modal
        open={modalAberto}
        onClose={() => !salvando && setModalAberto(false)}
        title={editar ? "Editar plano" : "Criar plano da plataforma"}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button icon="check" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : editar ? "Salvar alterações" : "Criar plano"}
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Input label="Nome" placeholder="Ex.: Revo Pro" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          <Input label="Identificador (slug)" hint="Ex.: pro. Usado no cadastro do consultor (consultorias.plano)." placeholder="pro" value={form.slug} disabled={!!editar} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          <div className={styles.formRow}>
            <Input label="Preço" prefix="R$" type="number" placeholder="60" value={form.preco} onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))} />
            <Input label="Limite de alunos" type="number" hint="0 = ilimitado" placeholder="150" value={form.limite} onChange={(e) => setForm((f) => ({ ...f, limite: e.target.value }))} />
          </div>
          <Textarea label="Descrição" placeholder="Para quem é este plano?" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
          {editar && (Number(form.preco.replace(",", ".")) || 0) !== editar.preco && (
            <label className={styles.propagar}>
              <Toggle checked={aplicarAssinaturas} onChange={setAplicarAssinaturas} aria-label="Aplicar novo preço às assinaturas ativas" />
              <span>
                <strong>Aplicar o novo preço às assinaturas ativas</strong>
                <small>
                  {editar.assinantes} consultoria(s) neste plano. Vale a partir da próxima cobrança; cobranças já emitidas não mudam.
                  Desligado, só novas assinaturas usam o valor novo.
                </small>
              </span>
            </label>
          )}
          {erro && <p style={{ color: "var(--color-text-danger)", fontSize: 13 }}>{erro}</p>}
        </div>
      </Modal>
    </>
  );
}
