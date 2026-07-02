"use client";

import { useState } from "react";
import { Button, Modal, Textarea, StatusBadge } from "@/components/ui";
import { solicitarCheckin, cancelarSolicitacaoCheckin } from "@/lib/db";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import styles from "./SolicitarCheckin.module.css";

/**
 * Controle do consultor para SOLICITAR um check-in ao aluno. Seta a flag
 * `checkin_solicitado` (+ mensagem opcional) no aluno; o app do aluno mostra o
 * pedido na home. A solicitação é limpa quando o aluno envia o check-in.
 */
export function SolicitarCheckin({
  alunoId,
  solicitadoInicial,
  msgInicial,
}: {
  alunoId: string;
  solicitadoInicial?: boolean;
  msgInicial?: string;
}) {
  const [solicitado, setSolicitado] = useState(!!solicitadoInicial);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(msgInicial ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function solicitar() {
    setEnviando(true);
    setErro("");
    try {
      if (supabaseEnabled) await solicitarCheckin(alunoId, msg);
      setSolicitado(true);
      setOpen(false);
    } catch (e) {
      setErro("Não foi possível solicitar. Rode o schema_checkin.sql atualizado.");
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    try {
      if (supabaseEnabled) await cancelarSolicitacaoCheckin(alunoId);
      setSolicitado(false);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  if (solicitado) {
    return (
      <span className={styles.wrap}>
        <StatusBadge variant="new" icon="bell" noDot>
          Check-in solicitado
        </StatusBadge>
        <Button variant="ghost" size="sm" onClick={cancelar}>
          Cancelar
        </Button>
      </span>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        icon="bell"
        onClick={() => setOpen(true)}
      >
        Solicitar check-in
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Solicitar check-in"
      >
        <div className={styles.body}>
          <p className={styles.sub}>
            O aluno verá um aviso na home pra enviar o check-in. Você pode
            incluir uma mensagem (opcional).
          </p>
          <Textarea
            placeholder="Ex.: Bora mandar o check-in dessa semana com as fotos! 💪"
            maxLength={240}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />
          {erro && <p className={styles.erro}>{erro}</p>}
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button icon="send" onClick={solicitar} disabled={enviando}>
              {enviando ? "Solicitando…" : "Solicitar"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
