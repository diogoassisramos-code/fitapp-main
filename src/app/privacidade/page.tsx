import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Política de Privacidade — Revo" };

const secoes: { titulo: string; corpo: string[] }[] = [
  {
    titulo: "1. Quem somos",
    corpo: [
      "A Revo é a controladora dos dados pessoais tratados na plataforma, nos termos da Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).",
    ],
  },
  {
    titulo: "2. Dados que coletamos",
    corpo: [
      "No cadastro: nome, e-mail, CPF e telefone. Ao contratar um plano: dados de pagamento processados pelo gateway (não armazenamos o número completo do cartão).",
      "Ao usar a plataforma: dados de uso (alunos, treinos, dietas, check-ins) que você mesmo cria.",
    ],
  },
  {
    titulo: "3. Para que usamos",
    corpo: [
      "Criar e manter sua conta; processar cobranças e assinaturas; prestar suporte; cumprir obrigações legais; e — mediante o seu consentimento — enviar comunicações de marketing por e-mail e WhatsApp.",
    ],
  },
  {
    titulo: "4. Bases legais",
    corpo: [
      "Execução de contrato (conta e cobrança), cumprimento de obrigação legal, legítimo interesse e consentimento (marketing). O consentimento é registrado no momento do cadastro e pode ser revogado a qualquer tempo.",
    ],
  },
  {
    titulo: "5. Compartilhamento",
    corpo: [
      "Compartilhamos dados apenas com operadores necessários ao serviço — por exemplo, o gateway de pagamento (Asaas) e a infraestrutura de banco de dados/autenticação (Supabase) — sempre no limite da finalidade.",
    ],
  },
  {
    titulo: "6. Seus direitos",
    corpo: [
      "Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus dados, além de revogar o consentimento de marketing, pelos canais de contato abaixo.",
    ],
  },
  {
    titulo: "7. Retenção",
    corpo: [
      "Mantemos os dados pelo tempo necessário às finalidades e às obrigações legais. Leads de marketing são mantidos até a revogação do consentimento ou solicitação de exclusão.",
    ],
  },
  {
    titulo: "8. Contato",
    corpo: ["Encarregado (DPO) e solicitações de privacidade: privacidade@revo.app."],
  },
];

export default function PrivacidadePage() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "var(--space-8) var(--space-5)",
        color: "var(--color-text-primary)",
      }}
    >
      <Link
        href="/cadastro"
        style={{ fontSize: 14, textDecoration: "underline", color: "var(--color-text-secondary)" }}
      >
        ← Voltar ao cadastro
      </Link>
      <h1 style={{ fontSize: 28, margin: "var(--space-4) 0 var(--space-2)" }}>
        Política de Privacidade
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginTop: 0 }}>
        Modelo inicial — revise com apoio jurídico antes de publicar em produção.
      </p>
      {secoes.map((s) => (
        <section key={s.titulo} style={{ marginTop: "var(--space-5)" }}>
          <h2 style={{ fontSize: 18, marginBottom: "var(--space-2)" }}>{s.titulo}</h2>
          {s.corpo.map((p, i) => (
            <p
              key={i}
              style={{
                color: "var(--color-text-secondary)",
                lineHeight: 1.6,
                margin: "0 0 var(--space-2)",
              }}
            >
              {p}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
