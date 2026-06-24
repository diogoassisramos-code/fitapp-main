"use client";

import { useState } from "react";
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
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { brl } from "@/lib/format";
import { listPlanosPlataforma, type PlanoPlataforma } from "@/lib/admin";
import styles from "./planos.module.css";

type FormState = {
  nome: string;
  preco: string;
  limite: string;
  descricao: string;
};

const FORM_VAZIO: FormState = { nome: "", preco: "", limite: "", descricao: "" };

export default function AdminPlanosPage() {
  const [planos, setPlanos] = useState<PlanoPlataforma[]>(() =>
    listPlanosPlataforma().map((p) => ({ ...p }))
  );
  const [contador, setContador] = useState(1);

  // Modal compartilhado para criar e editar.
  const [modalAberto, setModalAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);

  const mrr = planos.reduce((s, p) => s + p.preco * p.assinantes, 0);
  const planosAtivos = planos.filter((p) => p.status === "ativo").length;
  const assinantesTotais = planos.reduce((s, p) => s + p.assinantes, 0);

  function abrirCriar() {
    setEditId(null);
    setForm(FORM_VAZIO);
    setModalAberto(true);
  }

  function abrirEditar(p: PlanoPlataforma) {
    setEditId(p.id);
    setForm({
      nome: p.nome,
      preco: String(p.preco),
      limite: String(p.limiteAlunos),
      descricao: p.descricao,
    });
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditId(null);
    setForm(FORM_VAZIO);
  }

  function salvar() {
    if (!form.nome.trim()) return;
    const preco = Number(form.preco) || 0;
    const limite = Number(form.limite) || 0;

    if (editId) {
      // Edição: atualiza nome/preço/limite/descrição do plano.
      setPlanos((prev) =>
        prev.map((p) =>
          p.id === editId
            ? {
                ...p,
                nome: form.nome.trim(),
                preco,
                limiteAlunos: limite,
                descricao: form.descricao.trim(),
              }
            : p
        )
      );
    } else {
      // Criação de um novo plano.
      const n = contador;
      setContador((c) => c + 1);
      setPlanos((prev) => [
        ...prev,
        {
          id: `pp-novo-${n}`,
          nome: form.nome.trim(),
          descricao: form.descricao.trim(),
          preco,
          limiteAlunos: limite,
          recursos: [],
          assinantes: 0,
          status: "ativo",
        },
      ]);
    }
    fecharModal();
  }

  function arquivarAlternar(id: string) {
    setPlanos((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: p.status === "arquivado" ? "ativo" : "arquivado" }
          : p
      )
    );
  }

  function duplicar(p: PlanoPlataforma) {
    const n = contador;
    setContador((c) => c + 1);
    setPlanos((prev) => [
      ...prev,
      { ...p, id: `pp-dup-${n}`, nome: `${p.nome} (cópia)`, assinantes: 0, destaque: false },
    ]);
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

      <div className={styles.metrics}>
        <MetricCard
          label="MRR dos planos"
          value={brl(mrr)}
          sub="Receita recorrente mensal"
          icon="currency-real"
        />
        <MetricCard
          label="Planos ativos"
          value={planosAtivos}
          sub={`${planos.length} planos no total`}
          icon="layout-grid"
        />
        <MetricCard
          label="Assinantes totais"
          value={assinantesTotais}
          sub="Consultorias assinando"
          icon="building-store"
        />
      </div>

      <div className={styles.grid}>
        {planos.map((plano) => {
          const arquivado = plano.status === "arquivado";
          const gerado = plano.preco * plano.assinantes;
          return (
            <Card
              key={plano.id}
              className={[
                styles.plano,
                plano.destaque ? styles.destaque : "",
                arquivado ? styles.arquivado : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <CardBody className={styles.planoBody}>
                <div className={styles.planoTop}>
                  <div className={styles.tituloLinha}>
                    <h3 className={styles.planoNome}>{plano.nome}</h3>
                    {plano.destaque && (
                      <span className={styles.popular}>
                        <i className="ti ti-star-filled" aria-hidden /> Mais popular
                      </span>
                    )}
                    {arquivado && (
                      <StatusBadge variant="off" noDot>
                        Arquivado
                      </StatusBadge>
                    )}
                  </div>

                  <div className={styles.precoLinha}>
                    <span className={styles.preco}>{brl(plano.preco)}</span>
                    <span className={styles.precoUnidade}>/mês</span>
                  </div>

                  <p className={styles.descricao}>{plano.descricao}</p>
                </div>

                {/* Clientes no plano + receita que ele gera */}
                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>
                      <i className="ti ti-building" aria-hidden /> Clientes
                    </span>
                    <span className={styles.statValue}>{plano.assinantes}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>
                      <i className="ti ti-trending-up" aria-hidden /> Gera
                    </span>
                    <span className={styles.statValue} data-receita>
                      {brl(gerado)}
                      <span className={styles.statUnidade}>/mês</span>
                    </span>
                  </div>
                </div>

                <div className={styles.entregas}>
                  <span className={styles.entregasTitulo}>Entregas do plano</span>
                  <div className={styles.limite}>
                    <i className="ti ti-users" aria-hidden />
                    {plano.limiteAlunos === 0
                      ? "Alunos ilimitados"
                      : `Até ${plano.limiteAlunos} alunos`}
                  </div>
                  <ul className={styles.recursos}>
                    {plano.recursos.length === 0 ? (
                      <li className={styles.recursoVazio}>
                        Nenhuma entrega definida ainda.
                      </li>
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
                  <Button
                    variant="outline"
                    size="sm"
                    icon="pencil"
                    onClick={() => abrirEditar(plano)}
                  >
                    Editar nome e preço
                  </Button>
                  <KebabMenu
                    items={[
                      { label: "Editar", icon: "pencil", onClick: () => abrirEditar(plano) },
                      { label: "Duplicar", icon: "copy", onClick: () => duplicar(plano) },
                      {
                        label: arquivado ? "Reativar" : "Arquivar",
                        icon: arquivado ? "archive-off" : "archive",
                        danger: !arquivado,
                        separatorBefore: true,
                        onClick: () => arquivarAlternar(plano.id),
                      },
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
        onClose={fecharModal}
        title={editId ? "Editar plano" : "Criar plano da plataforma"}
        footer={
          <>
            <Button variant="outline" onClick={fecharModal}>
              Cancelar
            </Button>
            <Button icon="check" disabled={!form.nome.trim()} onClick={salvar}>
              {editId ? "Salvar alterações" : "Criar plano"}
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Input
            label="Nome"
            placeholder="Ex.: Pro"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
          <div className={styles.formRow}>
            <Input
              label="Preço"
              prefix="R$"
              type="number"
              placeholder="99"
              value={form.preco}
              onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))}
            />
            <Input
              label="Limite de alunos"
              type="number"
              hint="0 = ilimitado"
              placeholder="150"
              value={form.limite}
              onChange={(e) => setForm((f) => ({ ...f, limite: e.target.value }))}
            />
          </div>
          <Textarea
            label="Descrição"
            placeholder="Para quem é este plano?"
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          />
        </div>
      </Modal>
    </>
  );
}
