"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Input,
  CardSelect,
  Segmented,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { type StatusConsultoria } from "@/lib/admin";
import {
  adminUpdateConsultoria,
  adminUpdateConsultorNome,
  adminFetchPlanosPlataforma,
  type AdminConsultoria,
  type PlanoPlataforma,
} from "@/lib/adminDb";
import styles from "./consultor-form.module.css";

type StatusEditavel = Exclude<StatusConsultoria, "cancelado">;

const STATUS_OPTIONS: { label: string; value: StatusEditavel }[] = [
  { label: "Ativo", value: "ativo" },
  { label: "Trial", value: "trial" },
  { label: "Inadimplente", value: "inadimplente" },
  { label: "Suspenso", value: "suspenso" },
];

/** Formulário de EDIÇÃO de uma consultoria (o cadastro novo é por convite). */
export function ConsultorForm({ consultoria }: { consultoria: AdminConsultoria }) {
  const router = useRouter();

  const [planos, setPlanos] = useState<PlanoPlataforma[]>([]);
  useEffect(() => {
    adminFetchPlanosPlataforma().then(setPlanos).catch(() => {});
  }, []);

  const [consultor, setConsultor] = useState(consultoria.consultor);
  const [nomeNegocio, setNomeNegocio] = useState(consultoria.nomeNegocio);
  const [telefone, setTelefone] = useState(consultoria.telefone);
  const [conselho, setConselho] = useState(consultoria.conselho);
  const [planoSlug, setPlanoSlug] = useState(consultoria.planoSlug);
  const [status, setStatus] = useState<StatusEditavel>(
    consultoria.status !== "cancelado" ? consultoria.status : "ativo"
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const planoOptions = planos.map((p) => ({
    value: p.slug,
    label: p.nome,
    description: `R$ ${p.preco}/mês`,
    icon: "stack-2",
  }));

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await adminUpdateConsultoria(consultoria.id, {
        nomeNegocio: nomeNegocio.trim(),
        telefone: telefone.trim(),
        conselhoNumero: conselho.trim() || null,
        plano: planoSlug,
        status,
      });
      if (consultor.trim() && consultor.trim() !== consultoria.consultor) {
        await adminUpdateConsultorNome(consultoria.id, consultor.trim());
      }
      router.push(`/admin/consultores/${consultoria.id}`);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
      setSalvando(false);
    }
  }

  return (
    <form
      className={styles.page}
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <PageHeader
        eyebrow="Consultorias"
        title="Editar consultoria"
        subtitle="Atualize os dados cadastrais, o plano e o status."
        actions={
          <Button variant="ghost" icon="arrow-left" href={`/admin/consultores/${consultoria.id}`}>
            Voltar
          </Button>
        }
      />

      <div className={styles.sections}>
        <Card>
          <CardHeader title="Dados do consultor" />
          <CardBody>
            <div className={styles.grid2}>
              <Input label="Nome do consultor" icon="user" value={consultor} onChange={(e) => setConsultor(e.target.value)} />
              <Input label="Nome do negócio" icon="building-store" value={nomeNegocio} onChange={(e) => setNomeNegocio(e.target.value)} />
              <Input label="E-mail (login)" icon="mail" value={consultoria.email} disabled hint="O e-mail de login não é editável aqui." />
              <Input label="Telefone" icon="phone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              <Input label="Conselho (registro)" icon="certificate" placeholder="123456-G/SP" value={conselho} onChange={(e) => setConselho(e.target.value)} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Plano da plataforma" />
          <CardBody>
            {planoOptions.length > 0 ? (
              <CardSelect columns={3} options={planoOptions} value={planoSlug} onChange={setPlanoSlug} />
            ) : (
              <p className={styles.muted}>Carregando planos…</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Status da conta" />
          <CardBody>
            <div className={styles.statusRow}>
              <Segmented ariaLabel="Status da consultoria" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
            </div>
          </CardBody>
        </Card>
      </div>

      {erro && <p className={styles.erro}>{erro}</p>}

      <footer className={styles.footer}>
        <Button type="submit" icon="check" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
        <Button variant="outline" href={`/admin/consultores/${consultoria.id}`}>
          Cancelar
        </Button>
      </footer>
    </form>
  );
}
