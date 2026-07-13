"use client";

import { useRouter } from "next/navigation";
import { Avatar, StatusBadge, KebabMenu, EmptyState, ListRow } from "@/components/ui";
import { dataCurta } from "@/lib/format";
import { adminDeleteAluno, type AdminAluno } from "@/lib/adminDb";
import styles from "./detalhe.module.css";

export function AlunosList({
  alunos,
  onChanged,
}: {
  alunos: AdminAluno[];
  onChanged?: () => void;
}) {
  const router = useRouter();

  async function remover(a: AdminAluno) {
    if (!confirm(`Remover o aluno "${a.nome}"? Ação irreversível.`)) return;
    try {
      await adminDeleteAluno(a.id);
      onChanged?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao remover.");
    }
  }

  if (alunos.length === 0) {
    return (
      <div className={styles.emptyWrap}>
        <EmptyState
          icon="users"
          title="Nenhum aluno"
          description="Esta consultoria ainda não possui alunos cadastrados."
        />
      </div>
    );
  }

  return (
    <div className={styles.rows}>
      {alunos.map((a) => (
        <ListRow
          key={a.id}
          onClick={() => router.push(`/admin/alunos/${a.id}`)}
          leading={<Avatar name={a.nome} />}
          title={a.nome}
          meta={`${a.objetivo || "—"}${a.desde ? ` · desde ${dataCurta(a.desde)}` : ""}`}
          action={
            <div className={styles.rowActions}>
              <StatusBadge variant={a.status === "ativo" ? "ok" : "off"}>
                {a.status === "ativo" ? "Ativo" : "Inativo"}
              </StatusBadge>
              <KebabMenu
                items={[
                  {
                    label: "Ver perfil completo",
                    icon: "user-circle",
                    onClick: () => router.push(`/admin/alunos/${a.id}`),
                  },
                  {
                    label: "Remover",
                    icon: "trash",
                    danger: true,
                    separatorBefore: true,
                    onClick: () => remover(a),
                  },
                ]}
              />
            </div>
          }
        />
      ))}
    </div>
  );
}
