import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Termos de Uso — Revo" };

const secoes: { titulo: string; corpo: string[] }[] = [
  {
    titulo: "1. Aceitação",
    corpo: [
      "Ao criar uma conta e usar a plataforma Revo, você concorda com estes Termos de Uso e com a Política de Privacidade. Se não concordar, não utilize o serviço.",
    ],
  },
  {
    titulo: "2. O serviço",
    corpo: [
      "A Revo é uma plataforma para consultores de fitness gerenciarem alunos, treinos, dietas, check-ins e cobranças. Podemos evoluir, suspender ou descontinuar funcionalidades a qualquer momento, avisando quando fizer sentido.",
    ],
  },
  {
    titulo: "3. Conta e responsabilidades",
    corpo: [
      "Você é responsável pelos dados informados e por manter a senha em sigilo. As informações de cadastro (nome, e-mail, CPF, telefone) devem ser verdadeiras e atualizadas.",
      "Você é responsável pelo relacionamento com seus próprios alunos e pelo conteúdo que cria (treinos, dietas, protocolos).",
    ],
  },
  {
    titulo: "4. Planos e pagamento",
    corpo: [
      "Os planos pagos são cobrados de forma recorrente pelo gateway de pagamento (Asaas). O valor, a periodicidade e a forma de pagamento são exibidos antes da contratação.",
      "A liberação de recursos pagos depende da confirmação do pagamento. Cobranças no cartão podem levar até ~30 dias para liberar o valor ao recebedor, conforme regras do gateway.",
    ],
  },
  {
    titulo: "5. Cancelamento",
    corpo: [
      "Você pode cancelar a assinatura quando quiser. O cancelamento encerra a cobrança recorrente ao fim do ciclo vigente e mantém o acesso até lá. Não há devolução proporcional de período já pago, salvo quando exigido por lei.",
    ],
  },
  {
    titulo: "6. Comunicações e marketing",
    corpo: [
      "Com o seu consentimento, podemos enviar comunicações por e-mail e WhatsApp sobre a plataforma, novidades e ofertas. Você pode revogar esse consentimento a qualquer momento pelos canais indicados na Política de Privacidade.",
    ],
  },
  {
    titulo: "7. Propriedade intelectual",
    corpo: [
      "A marca, o software e os elementos visuais da Revo pertencem à Revo. O conteúdo que você cria na plataforma permanece seu.",
    ],
  },
  {
    titulo: "8. Limitação de responsabilidade",
    corpo: [
      "A plataforma é fornecida “no estado em que se encontra”. Na máxima extensão permitida por lei, a Revo não se responsabiliza por prejuízos indiretos decorrentes do uso do serviço.",
    ],
  },
  {
    titulo: "9. Alterações",
    corpo: [
      "Estes Termos podem ser atualizados. Mudanças relevantes serão comunicadas. O uso continuado após a atualização representa concordância.",
    ],
  },
  {
    titulo: "10. Contato",
    corpo: ["Dúvidas sobre estes Termos: suporte@revo.app."],
  },
];

export default function TermosPage() {
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
      <h1 style={{ fontSize: 28, margin: "var(--space-4) 0 var(--space-2)" }}>Termos de Uso</h1>
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
