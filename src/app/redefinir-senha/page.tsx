"use client";

// ============================================================================
// Destino do link "redefinir senha" enviado por e-mail (resetPasswordForEmail
// no dashboard E no app do aluno apontam pra cá). O cliente Supabase troca o
// `?code=` (PKCE) ou o `#access_token…&type=recovery` (implícito, vindo do
// app) por uma sessão ao carregar; aí o usuário escolhe a senha nova e segue
// pro painel (consultor) ou pra área do aluno.
// ============================================================================
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Card, CardBody, Input } from "@/components/ui";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/client";
import styles from "../recuperar-senha/recuperar-senha.module.css";

type Estado = "verificando" | "pronto" | "invalido";

/** Quanto tempo esperamos a troca do code/token antes de dar o link como inválido. */
const TIMEOUT_MS = 6000;

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>(
    supabaseEnabled ? "verificando" : "pronto"
  );
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled) return;

    // Erro explícito na URL (link expirado/já usado): Supabase manda
    // `?error=…&error_description=…` ou o mesmo no hash.
    const params = new URLSearchParams(
      window.location.search || window.location.hash.replace(/^#/, "?")
    );
    if (params.get("error") || params.get("error_description")) {
      setEstado("invalido");
      return;
    }

    const supabase = createClient();
    let resolvido = false;
    const concluir = (ok: boolean) => {
      if (resolvido) return;
      resolvido = true;
      setEstado(ok ? "pronto" : "invalido");
    };

    // Sessão já presente (code trocado antes do effect rodar) → pronto.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) concluir(true);
    });
    // Troca do code/token acontece de forma assíncrona na inicialização do
    // cliente; esperamos o evento correspondente.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        concluir(true);
      }
    });
    const timer = setTimeout(() => concluir(false), TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== confirmar) return setErro("As senhas não conferem.");

    // Protótipo (sem Supabase): só volta pro login.
    if (!supabaseEnabled) {
      setSalvo(true);
      return;
    }

    setSalvando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        setErro(
          /same|different/i.test(error.message)
            ? "A nova senha precisa ser diferente da atual."
            : /session|expired|invalid/i.test(error.message)
              ? "O link expirou. Peça um novo link de recuperação."
              : "Não foi possível salvar a senha. Tente de novo."
        );
        return;
      }
      setSalvo(true);
    } catch {
      setErro("Não foi possível salvar a senha agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  /** Já está logado (a troca do code criou a sessão): segue pro app conforme o papel. */
  async function continuar() {
    if (!supabaseEnabled) {
      router.push("/login");
      return;
    }
    const supabase = createClient();
    let destino = "/";
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.role === "aluno") destino = "/aluno";
    }
    router.push(destino);
    router.refresh();
  }

  if (estado === "verificando") {
    return (
      <AuthLayout>
        <div className={styles.head}>
          <h1 className={styles.title}>Redefinir senha</h1>
          <p className={styles.subtitle}>Validando seu link…</p>
        </div>
      </AuthLayout>
    );
  }

  if (estado === "invalido") {
    return (
      <AuthLayout>
        <Card>
          <CardBody>
            <div className={styles.confirm}>
              <span className={styles.confirmIcon} style={{ background: "var(--color-background-warning)", color: "var(--color-text-warning)" }}>
                <i className="ti ti-link-off" aria-hidden />
              </span>
              <h1 className={styles.title}>Link inválido ou expirado</h1>
              <p className={styles.subtitle}>
                O link de redefinição só vale por pouco tempo e pode ser usado
                uma vez. Peça um novo pra continuar.
              </p>
              <Button variant="primary" href="/recuperar-senha" fullWidth>
                Pedir novo link
              </Button>
              <Button variant="ghost" href="/login" fullWidth>
                Voltar para o login
              </Button>
            </div>
          </CardBody>
        </Card>
      </AuthLayout>
    );
  }

  if (salvo) {
    return (
      <AuthLayout>
        <Card>
          <CardBody>
            <div className={styles.confirm}>
              <span className={styles.confirmIcon}>
                <i className="ti ti-lock-check" aria-hidden />
              </span>
              <h1 className={styles.title}>Senha atualizada</h1>
              <p className={styles.subtitle}>
                Pronto — sua nova senha já vale. Use ela no app do aluno ou no
                painel a partir de agora.
              </p>
              <Button variant="primary" iconRight="arrow-right" fullWidth onClick={continuar}>
                Continuar
              </Button>
            </div>
          </CardBody>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className={styles.head}>
        <h1 className={styles.title}>Redefinir senha</h1>
        <p className={styles.subtitle}>Escolha uma nova senha para a sua conta.</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          label="Nova senha"
          icon="lock"
          type="password"
          placeholder="Mínimo de 6 caracteres"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="new-password"
        />
        <Input
          label="Confirmar nova senha"
          icon="lock-check"
          type="password"
          placeholder="Repita a senha"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          autoComplete="new-password"
        />

        {erro && <p className={styles.erro}>{erro}</p>}

        <Button type="submit" variant="primary" icon="check" fullWidth disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </AuthLayout>
  );
}
