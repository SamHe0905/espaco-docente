/**
 * Tela de login + cadastro do professor.
 * Tabs simples: Entrar | Cadastrar
 */
import { useState } from "react";
import { ArrowLeft, LogIn, UserPlus } from "lucide-react";
import { clsx } from "clsx";

import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Field";
import { api, ApiError } from "../lib/api";
import { saveAuth } from "../lib/userAuth";
import type { AuthState } from "../lib/userAuth";

interface Props {
  onVoltar: () => void;
  onSucesso: (a: AuthState) => void;
}

export function LoginUserScreen({ onVoltar, onSucesso }: Props) {
  const [aba, setAba] = useState<"entrar" | "cadastrar">("entrar");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [nome, setNome] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;

    if (aba === "cadastrar") {
      if (password !== password2) {
        setErro("As senhas não conferem");
        return;
      }
      if (password.length < 6) {
        setErro("Senha precisa ter pelo menos 6 caracteres");
        return;
      }
    }

    setCarregando(true);
    setErro(null);
    try {
      const resp =
        aba === "entrar"
          ? await api.login({ username: username.trim(), password })
          : await api.register({
              username: username.trim(),
              password,
              nome_exibicao: nome.trim() || undefined,
            });
      const auth: AuthState = { token: resp.token, user: resp.user };
      saveAuth(auth);
      onSucesso(auth);
    } catch (e) {
      if (e instanceof ApiError) {
        setErro(e.message);
      } else {
        setErro("Não foi possível conectar ao servidor");
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <header className="mb-8 flex items-center gap-3">
        <button
          onClick={onVoltar}
          className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          {aba === "entrar" ? (
            <LogIn className="h-5 w-5" strokeWidth={2} />
          ) : (
            <UserPlus className="h-5 w-5" strokeWidth={2} />
          )}
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
            {aba === "entrar" ? "Entrar na sua conta" : "Criar conta"}
          </h1>
          <p className="text-sm text-neutral-500">
            Salve suas atividades no seu perfil
          </p>
        </div>
      </header>

      <div className="mb-4 inline-flex rounded-lg border border-neutral-200 bg-white p-1">
        {(["entrar", "cadastrar"] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              setAba(k);
              setErro(null);
            }}
            className={clsx(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              aba === k
                ? "bg-brand-600 text-white"
                : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            {k === "entrar" ? "Entrar" : "Cadastrar"}
          </button>
        ))}
      </div>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-card"
      >
        <Input
          label="Usuário"
          hint={
            aba === "cadastrar"
              ? "3-32 caracteres: letras minúsculas, números, _, ., -"
              : undefined
          }
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoFocus
          required
        />
        <Input
          label="Senha"
          type="password"
          hint={aba === "cadastrar" ? "Mínimo 6 caracteres" : undefined}
          autoComplete={aba === "entrar" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {aba === "cadastrar" && (
          <>
            <Input
              label="Confirmar senha"
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
            />
            <Input
              label="Nome de exibição (opcional)"
              hint="Como você aparece pra você mesma — ex: Prof. Everton"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </>
        )}
        {erro && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {erro}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={carregando}
          disabled={!username.trim() || !password}
          className="w-full justify-center"
        >
          {aba === "entrar" ? "Entrar" : "Criar conta e entrar"}
        </Button>
        {aba === "entrar" && (
          <p className="text-center text-xs text-neutral-500">
            Esqueceu a senha? Fale com o administrador para resetar.
          </p>
        )}
      </form>
    </div>
  );
}
