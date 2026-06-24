"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  CardBody,
  CardSelect,
  Chip,
  Input,
  Segmented,
  SectionBlock,
  Textarea,
  Toggle,
} from "@/components/ui";
import type {
  Plano,
  TipoCobranca,
  Modalidade,
  PeriodoRecorrencia,
  FormaPagamento,
  UnidadePrazo,
  PlanoIncluso,
  CheckinConfig,
  FrequenciaCheckin,
} from "@/lib/types";
import {
  FORMA_PAGAMENTO_LABEL,
  FREQUENCIA_CHECKIN_LABEL,
  DIAS_SEMANA,
  diasSemanaResumo,
} from "@/lib/format";
import styles from "./plano-editor.module.css";

const FORMAS: FormaPagamento[] = ["cartao", "pix", "boleto"];
const FORMA_ICON: Record<FormaPagamento, string> = {
  cartao: "credit-card",
  pix: "brand-mastercard",
  boleto: "barcode",
};

const PARCELAS = [1, 2, 3, 4, 5, 6, 10, 12];

const INCLUSO_ITENS: { key: keyof PlanoIncluso; label: string; icon: string }[] = [
  { key: "treino", label: "Treino", icon: "barbell" },
  { key: "dieta", label: "Dieta", icon: "salad" },
  { key: "protocolos", label: "Protocolos extras", icon: "pill" },
  { key: "checkin", label: "Check-in semanal", icon: "camera" },
  { key: "chat", label: "Suporte por chat", icon: "message-circle" },
];

export function PlanoEditor({ plano }: { plano?: Plano }) {
  const router = useRouter();
  const editando = Boolean(plano);

  const [tipoCobranca, setTipoCobranca] = useState<TipoCobranca>(
    plano?.tipoCobranca ?? "recorrente"
  );
  const [modalidade, setModalidade] = useState<Modalidade | undefined>(
    plano?.modalidade
  );
  const [nome, setNome] = useState(plano?.nome ?? "");
  const [descricao, setDescricao] = useState(plano?.descricao ?? "");
  const [prazoValor, setPrazoValor] = useState(
    String(plano?.prazoEntrega.valor ?? "")
  );
  const [prazoUnidade, setPrazoUnidade] = useState<UnidadePrazo>(
    plano?.prazoEntrega.unidade ?? "dias_uteis"
  );
  const [capa, setCapa] = useState<string | undefined>(plano?.imagemCapa);

  const [incluso, setIncluso] = useState<PlanoIncluso>(
    plano?.incluso ?? {
      treino: true,
      dieta: true,
      protocolos: false,
      checkin: true,
      chat: true,
    }
  );

  const [preco, setPreco] = useState(plano ? String(plano.preco) : "");
  const [periodo, setPeriodo] = useState<PeriodoRecorrencia>(
    plano?.periodoRecorrencia ?? "mensal"
  );
  const [formas, setFormas] = useState<FormaPagamento[]>(
    plano?.formasPagamento ?? ["cartao", "pix"]
  );
  const [parcelas, setParcelas] = useState<number>(plano?.parcelamentoMax ?? 1);

  const [solicitarDocumentos, setSolicitarDocumentos] = useState(
    plano?.solicitarDocumentos ?? false
  );
  const [agendarCheckins, setAgendarCheckins] = useState(
    plano?.agendarCheckins ?? false
  );
  const [checkinConfig, setCheckinConfig] = useState<CheckinConfig>(
    plano?.checkinConfig ?? {
      frequencia: "semanal",
      diasSemana: [1],
      horario: "09:00",
    }
  );

  const [upsellAtivo, setUpsellAtivo] = useState(plano?.upsell?.ativo ?? false);
  const [upsellTexto, setUpsellTexto] = useState("");

  const [venda, setVenda] = useState(plano?.visibilidade.venda ?? true);
  const [vitrine, setVitrine] = useState(plano?.visibilidade.vitrine ?? false);
  const [renovacao, setRenovacao] = useState(
    plano?.visibilidade.renovacao ?? true
  );
  const [checkoutCustom, setCheckoutCustom] = useState(
    Boolean(plano?.checkoutCustom)
  );

  const [aplicarAtuais, setAplicarAtuais] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const link = plano?.linkPagamento ?? "";

  function toggleIncluso(key: keyof PlanoIncluso) {
    setIncluso((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleForma(f: FormaPagamento) {
    setFormas((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }

  function toggleDiaCheckin(dia: number) {
    setCheckinConfig((prev) => ({
      ...prev,
      diasSemana: prev.diasSemana.includes(dia)
        ? prev.diasSemana.filter((d) => d !== dia)
        : [...prev.diasSemana, dia],
    }));
  }

  function onCapaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setCapa(URL.createObjectURL(file));
  }

  function copiarLink() {
    if (!link) return;
    navigator.clipboard?.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  function salvar() {
    router.push("/planos");
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={editando ? "Editar" : "Novo"}
        title={editando ? "Editar plano" : "Criar plano"}
        subtitle="Configure cobrança, conteúdo e checkout do plano."
      />

      <div className={styles.sections}>
        {/* 1. Tipo de cobrança */}
        <Card>
          <CardBody>
            <SectionBlock
              number={1}
              title="Tipo de cobrança"
              description="Como o aluno paga por este plano."
            >
              <CardSelect<TipoCobranca>
                columns={3}
                value={tipoCobranca}
                onChange={setTipoCobranca}
                options={[
                  {
                    value: "recorrente",
                    label: "Assinatura recorrente",
                    description: "Cobrança automática que se repete",
                    icon: "repeat",
                  },
                  {
                    value: "pacote",
                    label: "Pacote fechado",
                    description: "Paga uma vez",
                    icon: "package",
                  },
                  {
                    value: "avulso",
                    label: "Cobrança avulsa",
                    description: "Link único",
                    icon: "receipt",
                  },
                ]}
              />
            </SectionBlock>
          </CardBody>
        </Card>

        {/* 2. Modalidade */}
        <Card>
          <CardBody>
            <SectionBlock
              number={2}
              title="Modalidade"
              description="Opcional — ajuda a organizar a vitrine."
            >
              <CardSelect<Modalidade>
                columns={3}
                value={modalidade}
                onChange={setModalidade}
                options={[
                  {
                    value: "online",
                    label: "Online",
                    description: "Acompanhamento à distância",
                    icon: "device-laptop",
                  },
                  {
                    value: "personal",
                    label: "Personal",
                    description: "Treino presencial",
                    icon: "barbell",
                  },
                  {
                    value: "consulta",
                    label: "Consulta",
                    description: "Atendimento pontual",
                    icon: "stethoscope",
                  },
                ]}
              />
            </SectionBlock>
          </CardBody>
        </Card>

        {/* 3. Detalhes */}
        <Card>
          <CardBody>
            <SectionBlock
              number={3}
              title="Detalhes"
              description="Nome, descrição e prazo de entrega do plano."
            >
              <div className={styles.stack}>
                <Input
                  label="Nome do plano"
                  id="nome"
                  placeholder="Ex.: Consultoria Online Mensal"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
                <Textarea
                  label="Descrição"
                  id="descricao"
                  hint="Aparece no checkout e na vitrine."
                  maxLength={250}
                  rows={3}
                  placeholder="O que o aluno recebe ao contratar este plano..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />

                <div className={styles.grid2}>
                  <Input
                    label="Prazo de entrega"
                    id="prazo"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="2"
                    value={prazoValor}
                    onChange={(e) => setPrazoValor(e.target.value)}
                  />
                  <div className={styles.field}>
                    <span className={styles.label}>Unidade</span>
                    <Segmented<UnidadePrazo>
                      ariaLabel="Unidade do prazo de entrega"
                      value={prazoUnidade}
                      onChange={setPrazoUnidade}
                      options={[
                        { label: "Horas", value: "horas" },
                        { label: "Dias úteis", value: "dias_uteis" },
                      ]}
                    />
                  </div>
                </div>

                {/* Imagem de capa */}
                <div className={styles.field}>
                  <span className={styles.label}>Imagem de capa do plano</span>
                  <div className={styles.capaRow}>
                    <div className={styles.capaPreview} data-empty={!capa}>
                      {capa ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={capa} alt="Prévia da capa do plano" />
                      ) : (
                        <i className="ti ti-photo" aria-hidden />
                      )}
                    </div>
                    <div className={styles.capaInfo}>
                      <label className={styles.uploadBtn}>
                        <i className="ti ti-upload" aria-hidden />
                        {capa ? "Trocar imagem" : "Enviar imagem"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onCapaChange}
                          className={styles.fileInput}
                        />
                      </label>
                      <span className={styles.capaHint}>
                        Aparece no link de checkout do aluno.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </SectionBlock>
          </CardBody>
        </Card>

        {/* 4. O que está incluído */}
        <Card>
          <CardBody>
            <SectionBlock
              number={4}
              title="O que está incluído"
              description="Controla o que o aluno vê no app."
            >
              <ul className={styles.inclusoList}>
                {INCLUSO_ITENS.map((item) => (
                  <li key={item.key} className={styles.inclusoRow}>
                    <span className={styles.inclusoLabel}>
                      <span className={styles.inclusoIcon} aria-hidden>
                        <i className={`ti ti-${item.icon}`} />
                      </span>
                      {item.label}
                    </span>
                    <Toggle
                      checked={incluso[item.key]}
                      onChange={() => toggleIncluso(item.key)}
                      aria-label={item.label}
                    />
                  </li>
                ))}
              </ul>
            </SectionBlock>
          </CardBody>
        </Card>

        {/* 5. Preço e pagamento */}
        <Card>
          <CardBody>
            <SectionBlock
              number={5}
              title="Preço e pagamento"
              description="Valor cobrado e formas aceitas no checkout."
            >
              <div className={styles.stack}>
                <div className={styles.grid2}>
                  <Input
                    label="Preço"
                    id="preco"
                    prefix="R$"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    placeholder="0,00"
                    value={preco}
                    onChange={(e) => setPreco(e.target.value)}
                  />
                  {tipoCobranca === "recorrente" && (
                    <div className={styles.field}>
                      <span className={styles.label}>Período de cobrança</span>
                      <Segmented<PeriodoRecorrencia>
                        ariaLabel="Período de recorrência"
                        value={periodo}
                        onChange={setPeriodo}
                        options={[
                          { label: "Semanal", value: "semanal" },
                          { label: "Mensal", value: "mensal" },
                          { label: "Trimestral", value: "trimestral" },
                          { label: "Anual", value: "anual" },
                        ]}
                      />
                    </div>
                  )}
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>Formas de pagamento</span>
                  <div className={styles.chips}>
                    {FORMAS.map((f) => (
                      <Chip
                        key={f}
                        icon={FORMA_ICON[f]}
                        selected={formas.includes(f)}
                        onClick={() => toggleForma(f)}
                      >
                        {FORMA_PAGAMENTO_LABEL[f]}
                      </Chip>
                    ))}
                  </div>
                </div>

                {tipoCobranca !== "recorrente" && (
                  <div className={styles.field}>
                    <span className={styles.label}>Parcelamento máximo</span>
                    <Segmented<string>
                      ariaLabel="Parcelamento máximo"
                      value={String(parcelas)}
                      onChange={(v) => setParcelas(Number(v))}
                      options={PARCELAS.map((p) => ({
                        label: `${p}x`,
                        value: String(p),
                      }))}
                    />
                  </div>
                )}

                <div className={styles.aviso}>
                  <i className="ti ti-info-circle" aria-hidden />
                  <div className={styles.avisoBody}>
                    <p>
                      Mudanças de preço/recorrência valem para novos
                      assinantes; os atuais mantêm o valor.
                    </p>
                    <label className={styles.avisoToggle}>
                      <Toggle
                        checked={aplicarAtuais}
                        onChange={setAplicarAtuais}
                        aria-label="Aplicar aos assinantes atuais na próxima renovação"
                      />
                      Aplicar aos assinantes atuais na próxima renovação
                    </label>
                  </div>
                </div>
              </div>
            </SectionBlock>
          </CardBody>
        </Card>

        {/* 6. Configurações avançadas */}
        <Card>
          <CardBody>
            <SectionBlock
              number={6}
              title="Configurações avançadas"
              description="Automatize a coleta de dados e os check-ins."
            >
              <ul className={styles.inclusoList}>
                <li className={styles.inclusoRow}>
                  <span className={styles.toggleText}>
                    <span className={styles.inclusoLabel}>
                      <span className={styles.inclusoIcon} aria-hidden>
                        <i className="ti ti-file-text" />
                      </span>
                      Solicitar documentos na 1ª compra
                    </span>
                    <span className={styles.toggleNote}>
                      Dispara a anamnese automaticamente no primeiro acesso.
                    </span>
                  </span>
                  <Toggle
                    checked={solicitarDocumentos}
                    onChange={setSolicitarDocumentos}
                    aria-label="Solicitar documentos na 1ª compra"
                  />
                </li>
                <li className={styles.inclusoRow}>
                  <span className={styles.inclusoLabel}>
                    <span className={styles.inclusoIcon} aria-hidden>
                      <i className="ti ti-calendar-event" />
                    </span>
                    Agendar check-ins automáticos
                  </span>
                  <Toggle
                    checked={agendarCheckins}
                    onChange={setAgendarCheckins}
                    aria-label="Agendar check-ins automáticos"
                  />
                </li>
              </ul>

              {agendarCheckins && (
                <div className={styles.checkinConfig}>
                  <div className={styles.field}>
                    <span className={styles.label}>Frequência</span>
                    <Segmented<FrequenciaCheckin>
                      ariaLabel="Frequência do check-in"
                      value={checkinConfig.frequencia}
                      onChange={(frequencia) =>
                        setCheckinConfig((prev) => ({ ...prev, frequencia }))
                      }
                      options={(
                        ["semanal", "quinzenal", "mensal"] as FrequenciaCheckin[]
                      ).map((f) => ({
                        label: FREQUENCIA_CHECKIN_LABEL[f],
                        value: f,
                      }))}
                    />
                  </div>

                  <div className={styles.field}>
                    <span className={styles.label}>Dias da semana</span>
                    <div className={styles.chips}>
                      {DIAS_SEMANA.map((dia, i) => (
                        <Chip
                          key={i}
                          selected={checkinConfig.diasSemana.includes(i)}
                          onClick={() => toggleDiaCheckin(i)}
                        >
                          {dia}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div className={styles.field}>
                    <Input
                      label="Horário do lembrete"
                      id="checkin-horario"
                      type="time"
                      icon="clock"
                      value={checkinConfig.horario ?? ""}
                      onChange={(e) =>
                        setCheckinConfig((prev) => ({
                          ...prev,
                          horario: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <p className={styles.checkinResumo}>
                    <i className="ti ti-calendar-check" aria-hidden />
                    {"Check-in " +
                      FREQUENCIA_CHECKIN_LABEL[
                        checkinConfig.frequencia
                      ].toLowerCase() +
                      (checkinConfig.horario
                        ? " às " + checkinConfig.horario
                        : "") +
                      " · " +
                      diasSemanaResumo(checkinConfig.diasSemana)}
                  </p>
                </div>
              )}
            </SectionBlock>
          </CardBody>
        </Card>

        {/* 7. Upsell — só quando não recorrente */}
        {tipoCobranca !== "recorrente" && (
          <Card>
            <CardBody>
              <SectionBlock
                number={7}
                title="Oferta de upsell"
                description="Ofereça um upgrade logo após a compra."
              >
                <div className={styles.stack}>
                  <div className={styles.inclusoRow}>
                    <span className={styles.inclusoLabel}>
                      <span className={styles.inclusoIcon} aria-hidden>
                        <i className="ti ti-trending-up" />
                      </span>
                      Oferecer upsell no checkout
                    </span>
                    <Toggle
                      checked={upsellAtivo}
                      onChange={setUpsellAtivo}
                      aria-label="Oferecer upsell"
                    />
                  </div>
                  {upsellAtivo && (
                    <Input
                      label="Texto da oferta"
                      id="upsell"
                      icon="gift"
                      placeholder="Ex.: Adicione 1 mês extra com 30% off"
                      value={upsellTexto}
                      onChange={(e) => setUpsellTexto(e.target.value)}
                    />
                  )}
                </div>
              </SectionBlock>
            </CardBody>
          </Card>
        )}

        {/* 8. Visibilidade e checkout */}
        <Card>
          <CardBody>
            <SectionBlock
              number={8}
              title="Visibilidade e checkout"
              description="Onde e como este plano fica disponível."
            >
              <ul className={styles.inclusoList}>
                <li className={styles.inclusoRow}>
                  <span className={styles.inclusoLabel}>
                    <span className={styles.inclusoIcon} aria-hidden>
                      <i className="ti ti-shopping-cart" />
                    </span>
                    Disponível para venda
                  </span>
                  <Toggle
                    checked={venda}
                    onChange={setVenda}
                    aria-label="Disponível para venda"
                  />
                </li>
                <li className={styles.inclusoRow}>
                  <span className={styles.inclusoLabel}>
                    <span className={styles.inclusoIcon} aria-hidden>
                      <i className="ti ti-building-store" />
                    </span>
                    Exibir na vitrine
                  </span>
                  <Toggle
                    checked={vitrine}
                    onChange={setVitrine}
                    aria-label="Exibir na vitrine"
                  />
                </li>
                <li className={styles.inclusoRow}>
                  <span className={styles.inclusoLabel}>
                    <span className={styles.inclusoIcon} aria-hidden>
                      <i className="ti ti-refresh" />
                    </span>
                    Disponível em link de renovação
                  </span>
                  <Toggle
                    checked={renovacao}
                    onChange={setRenovacao}
                    aria-label="Disponível em link de renovação"
                  />
                </li>
                <li className={styles.inclusoRow}>
                  <span className={styles.inclusoLabel}>
                    <span className={styles.inclusoIcon} aria-hidden>
                      <i className="ti ti-palette" />
                    </span>
                    Personalizar checkout
                  </span>
                  <Toggle
                    checked={checkoutCustom}
                    onChange={setCheckoutCustom}
                    aria-label="Personalizar checkout"
                  />
                </li>
              </ul>
            </SectionBlock>
          </CardBody>
        </Card>

        {/* 9. Link de pagamento */}
        <Card>
          <CardBody>
            <SectionBlock
              number={9}
              title="Link de pagamento"
              description="Compartilhe o checkout direto com o aluno."
            >
              <div className={styles.stack}>
                <Input
                  label="URL do checkout"
                  id="link"
                  icon="link"
                  readOnly
                  value={link || "Gerado ao salvar"}
                  hint={
                    !link
                      ? "O link é gerado ao salvar o plano."
                      : undefined
                  }
                />
                <div className={styles.linkActions}>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={copiado ? "check" : "copy"}
                    onClick={copiarLink}
                    disabled={!link}
                  >
                    {copiado ? "Copiado" : "Copiar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon="qrcode"
                    disabled={!link}
                  >
                    Gerar QR
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon="share"
                    disabled={!link}
                  >
                    Compartilhar
                  </Button>
                  <Button variant="ghost" size="sm" icon="ticket">
                    Criar cupom
                  </Button>
                </div>
              </div>
            </SectionBlock>
          </CardBody>
        </Card>
      </div>

      {/* Rodapé fixo */}
      <div className={styles.footer}>
        <div className={styles.footerInner}>
          <Button icon="check" onClick={salvar}>
            Salvar plano
          </Button>
          <Button variant="outline" href="/planos">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
