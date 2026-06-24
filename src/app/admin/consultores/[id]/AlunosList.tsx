"use client";

import { useRouter } from "next/navigation";
import { Avatar, StatusBadge, KebabMenu, EmptyState, ListRow } from "@/components/ui";
import { dataCurta } from "@/lib/format";
import type { AlunoPlataforma } from "@/lib/admin";
import styles from "./detalhe.module.css";

export function AlunosList({ alunos }: { alunos: AlunoPlataforma[] }) {
  const router = useRouter();

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
          meta={`${a.objetivo} · desde ${dataCurta(a.desde)}`}
          action={
            <div className={styles.rowActions}>
              {a.status === "ativo" ? (
                <StatusBadge variant="ok">Ativo</StatusBadge>
              ) : (
                <StatusBadge variant="off">Inativo</StatusBadge>
              )}
              <KebabMenu
                items={[
                  {
                    label: "Ver perfil completo",
                    icon: "user-circle",
                    onClick: () => router.push(`/admin/alunos/${a.id}`),
                  },
                  {
                    label: "Editar",
                    icon: "pencil",
                    onClick: () => {},
                  },
                  {
                    label: "Remover",
                    icon: "trash",
                    danger: true,
                    separatorBefore: true,
                    onClick: () => {},
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
