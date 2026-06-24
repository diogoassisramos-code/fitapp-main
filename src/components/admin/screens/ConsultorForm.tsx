"use client";

import { useState } from "react";
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
import {
  listPlanosPlataforma,
  type Consultoria,
  type StatusConsultoria,
} from "@/lib/admin";
import styles from "./consultor-form.module.css";

type StatusEditavel = Exclude<StatusConsultoria, "cancelado">;

const STATUS_OPTIONS: { label: string; value: StatusEditavel }[] = [
  { label: "Ativo", value: "ativo" },
  { label: "Trial", value: "trial" },
  { label: "Inadimplente", value: "inadimplente" },
  { label: "Suspenso", value: "suspenso" },
];

export function ConsultorForm({ consultoria }: { consultoria?: Consultoria }) {
  const router = useRouter();
  const editando = Boolean(consultoria);

  const planos = listPlanosPlataforma();

  const [consultor, setConsultor] = useState(consultoria?.consultor ?? "");
  const [nomeNegocio, setNomeNegocio] = useState(consultoria?.nomeNegocio ?? "");
  const [email, setEmail] = useState(consultoria?.email ?? "");
  const [telefone, setTelefone] = useState(consultoria?.telefone ?? "");
  const [conselho, setConselho] = useState(consultoria?.conselho ?? "");
  const [cidade, setCidade] = useState(consultoria?.cidade ?? "");
  const [planoId, setPlanoId] = useState<string>(
    consultoria?.planoPlataformaId ?? planos[0]?.id ?? ""
  );
  const [status, setStatus] = useState<StatusEditavel>(
    consultoria && consultoria.status !== "cancelado"
      ? consultoria.status
      : "ativo"
  );

  const planoOptions = planos.map((p) => ({
    value: p.id,
    label: p.nome,
    description: `R$ ${p.preco}/mês`,
    icon: "stack-2",
  }));

  function salvar() {
    // Protótipo: sem persistência — apenas retorna à listagem.
    router.push("/admin/consultores");
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
        title={editando ? "Editar consultoria" : "Nova consultoria"}
        subtitle={
          editando
            ? "Atualize os dados cadastrais e o plano da plataforma."
            : "Cadastre uma nova conta de consultor na plataforma."
        }
        actions={
          <Button variant="ghost" icon="arrow-left" href="/admin/consultores">
            Voltar
          </Button>
        }
      />

      <div className={styles.sections}>
        <Card>
          <CardHeader title="Dados do consultor" />
          <CardBody>
            <div className={styles.grid2}>
              <Input
                label="Nome do consultor"
                icon="user"
                placeholder="Rafael Mendes"
                value={consultor}
                onChange={(e) => setConsultor(e.target.value)}
              />
              <Input
                label="Nome do negócio"
                icon="building-store"
                placeholder="CoachFit"
                value={nomeNegocio}
                onChange={(e) => setNomeNegocio(e.target.value)}
              />
              <Input
                label="E-mail"
                type="email"
                icon="mail"
                placeholder="rafael@coachfit.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Telefone"
                icon="phone"
                placeholder="(11) 98888-1234"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
              <Input
                label="Conselho"
                icon="certificate"
                placeholder="CREF 123456-G/SP"
                value={conselho}
                onChange={(e) => setConselho(e.target.value)}
              />
              <Input
                label="Cidade"
                icon="map-pin"
                placeholder="São Paulo, SP"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Plano da plataforma" />
          <CardBody>
            <CardSelect
              columns={3}
              options={planoOptions}
              value={planoId}
              onChange={setPlanoId}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Status da conta" />
          <CardBody>
            <div className={styles.statusRow}>
              <Segmented
                ariaLabel="Status da consultoria"
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <footer className={styles.footer}>
        <Button type="submit" icon="check">
          Salvar
        </Button>
        <Button variant="outline" href="/admin/consultores">
          Cancelar
        </Button>
      </footer>
    </form>
  );
}
