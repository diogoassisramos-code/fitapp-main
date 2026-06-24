"use client";

import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  EmptyState,
  Input,
  StatusBadge,
} from "@/components/ui";
import {
  getTestAluno,
  camposPendentes,
  conviteUrl,
  type TestAluno,
} from "@/lib/testAlunos";
import styles from "./test-aluno-ficha.module.css";

export function TestAlunoFicha({ id }: { id: string }) {
  const [mounted, setMounted] = useState(false);
  const [aluno, setAluno] = useState<TestAluno | undefined>(undefined);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAluno(getTestAluno(id));
  }, [id]);

  // (i) Antes de montar — placeholder neutro (evita mismatch de hidratação)
  if (!mounted) {
    return <div className={styles.placeholder} aria-hidden />;
  }

  // (ii) Montou mas não encontrou
  if (!aluno) {
    return (
      <div className={styles.notFound}>
        <Card padded>
          <EmptyState
            icon="user-question"
            title="Aluno não encontrado"
            description="Este aluno não existe ou o convite foi removido."
            action={
              <Button variant="primary" icon="arrow-left" href="/alunos">
                Voltar para alunos
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  // (iii) Encontrou o aluno de teste
  const pendentes = camposPendentes(aluno);
  const url = conviteUrl(aluno.conviteToken);

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  const dado = (v: string) => (v.trim() ? v.trim() : "—");

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.hero}>
        <Avatar name={aluno.nome} size={64} />
        <div className={styles.heroText}>
          <h1 className={styles.name}>{aluno.nome}</h1>
          <div className={styles.heroBadges}>
            <StatusBadge variant="new">Aluno de teste</StatusBadge>
            <StatusBadge variant="pending" icon="mail" noDot>
              Convite pendente
            </StatusBadge>
          </div>
        </div>
      </header>

      {/* Dados básicos */}
      <Card padded={false}>
        <CardHeader title="Dados básicos" />
        <CardBody className={styles.dadosBody}>
          <div className={styles.dadosGrid}>
            <Dado label="Nome" valor={dado(aluno.nome)} />
            <Dado
              label="Idade"
              valor={aluno.idade.trim() ? `${aluno.idade.trim()} anos` : "—"}
            />
            <Dado
              label="Altura"
              valor={aluno.altura.trim() ? `${aluno.altura.trim()} cm` : "—"}
            />
            <Dado label="E-mail" valor={dado(aluno.email)} />
            <Dado label="Telefone" valor={dado(aluno.telefone)} />
            <Dado label="Objetivo" valor={dado(aluno.objetivo)} />
          </div>
          <Dado label="Observações" valor={dado(aluno.observacoes)} full />
        </CardBody>
      </Card>

      {/* Convite */}
      <Card padded={false}>
        <CardHeader title="Convite" />
        <CardBody className={styles.conviteBody}>
          <p className={styles.conviteText}>
            Envie o link para o aluno completar o cadastro.
          </p>
          <div className={styles.linkRow}>
            <div className={styles.linkInput}>
              <Input
                readOnly
                value={url}
                icon="link"
                aria-label="Link de convite"
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
            <Button
              variant="primary"
              icon={copiado ? "check" : "copy"}
              onClick={copiarLink}
            >
              {copiado ? "Copiado!" : "Copiar link"}
            </Button>
          </div>

          <div className={styles.pendentes}>
            <span className="mono-label">O que falta o aluno preencher</span>
            {pendentes.length > 0 ? (
              <div className={styles.chips}>
                {pendentes.map((p) => (
                  <Chip key={p}>{p}</Chip>
                ))}
              </div>
            ) : (
              <StatusBadge variant="ok" icon="check" noDot>
                Cadastro completo
              </StatusBadge>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Protocolo atual — pontos de entrada para montar os planos */}
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Protocolo atual</h2>
          <p className={styles.blockSub}>
            Monte o programa do aluno enquanto o cadastro é concluído.
          </p>
        </div>
        <div className={styles.protocols}>
          <ProtoCard
            tone="info"
            icon="barbell"
            label="Treino"
            href={`/alunos/${id}/treino`}
          />
          <ProtoCard
            tone="success"
            icon="salad"
            label="Dieta"
            href={`/alunos/${id}/dieta`}
          />
          <ProtoCard
            tone="warning"
            icon="pill"
            label="Protocolos extras"
            href={`/alunos/${id}/protocolo`}
          />
        </div>
      </section>
    </div>
  );
}

function Dado({
  label,
  valor,
  full,
}: {
  label: string;
  valor: string;
  full?: boolean;
}) {
  return (
    <div className={styles.dado} data-full={full || undefined}>
      <span className="mono-label">{label}</span>
      <span className={styles.dadoVal}>{valor}</span>
    </div>
  );
}

function ProtoCard({
  tone,
  icon,
  label,
  href,
}: {
  tone: "info" | "success" | "warning";
  icon: string;
  label: string;
  href: string;
}) {
  return (
    <Card padded className={styles.protocol}>
      <div className={styles.protoIcon} data-tone={tone}>
        <i className={`ti ti-${icon}`} aria-hidden />
      </div>
      <span className="mono-label">{label}</span>
      <p className={styles.protoMeta}>Ainda não montado</p>
      <div className={styles.protoAction}>
        <Button variant="ghost" size="sm" iconRight="arrow-right" href={href}>
          Montar
        </Button>
      </div>
    </Card>
  );
}
