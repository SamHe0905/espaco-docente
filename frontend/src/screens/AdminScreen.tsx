import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Database,
  Flame,
  LineChart,
  LogOut,
  Lock,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Field";
import {
  adminHeaders,
  clearCreds,
  loadCreds,
  saveCreds,
} from "../lib/adminAuth";
import type { AdminCreds } from "../lib/adminAuth";

interface ProviderStats {
  tokens: number;
  requests: number;
}

interface SeriePonto {
  dia: string;
  total: number;
  [provider: string]: number | string;
}

interface CacheTema {
  tema: string | null;
  disciplina: string | null;
  etapa: string | null;
  modo: string | null;
  hits: number;
}

interface Stats {
  periodo_dias: number;
  atualizado_em: string;
  por_provider: Record<string, ProviderStats>;
  serie_30d: SeriePonto[];
  cache: {
    total_entries: number;
    total_hits: number;
    por_modo: Record<string, number>;
    tokens_economizados_estimados: number;
  };
  top_cache_temas: CacheTema[];
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const PROVIDER_COR: Record<string, string> = {
  groq: "bg-amber-500",
  cerebras: "bg-emerald-500",
  gemini: "bg-sky-500",
  openrouter: "bg-violet-500",
};

const MODO_LABEL: Record<string, string> = {
  plano_de_aula: "Plano de Aula",
  sugestao_de_aula: "Sugestão de Aula",
  lista_de_exercicios: "Lista de Exercícios",
  projetos_e_trabalhos: "Projetos",
  recomposicao_paralela: "Recomposição",
  adaptacao_educacao_especial: "Adaptação",
};

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

interface Props {
  onVoltar: () => void;
}

export function AdminScreen({ onVoltar }: Props) {
  const [creds, setCreds] = useState<AdminCreds | null>(() => loadCreds());
  const [stats, setStats] = useState<Stats | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!creds) return;
    setErro(null);
    fetch(`${API_BASE}/admin/stats`, { headers: adminHeaders(creds) })
      .then((r) => {
        if (r.status === 401) {
          // credenciais salvas estao invalidas — limpa e volta pro login
          clearCreds();
          setCreds(null);
          throw new Error("Credenciais inválidas");
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setStats(d))
      .catch((e) => setErro(String(e.message || e)));
  }, [creds]);

  // Sem credenciais salvas → tela de login
  if (!creds) {
    return <LoginScreen onSucesso={setCreds} onVoltar={onVoltar} />;
  }

  if (erro) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não foi possível carregar as estatísticas: {erro}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearCreds();
            setCreds(null);
          }}
          icon={<LogOut className="h-4 w-4" />}
          className="mt-3"
        >
          Sair e tentar de novo
        </Button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-sm text-neutral-500">Carregando estatísticas…</p>
      </div>
    );
  }

  const providerEntries = Object.entries(stats.por_provider);
  const totalRequests = providerEntries.reduce(
    (sum, [, s]) => sum + s.requests,
    0,
  );
  const totalTokens = providerEntries.reduce(
    (sum, [, s]) => sum + s.tokens,
    0,
  );
  const maxProviderTokens = Math.max(
    1,
    ...providerEntries.map(([, s]) => s.tokens),
  );

  const totalGeracoes =
    totalRequests + stats.cache.total_hits; // requests + cache hits
  const hitRate =
    totalGeracoes > 0
      ? Math.round((stats.cache.total_hits / totalGeracoes) * 100)
      : 0;

  const maxDayTotal = Math.max(1, ...stats.serie_30d.map((p) => p.total));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-start gap-3">
        <button
          onClick={onVoltar}
          className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <LineChart className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
            Painel administrativo
          </h1>
          <p className="text-sm text-neutral-500">
            Últimos {stats.periodo_dias} dias • atualizado{" "}
            {new Date(stats.atualizado_em).toLocaleString("pt-BR")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearCreds();
            setCreds(null);
          }}
          icon={<LogOut className="h-4 w-4" />}
        >
          Sair
        </Button>
      </header>

      {/* Cards de totais */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CardTotal
          icone={<Activity className="h-5 w-5" />}
          titulo="Gerações totais"
          valor={fmtK(totalGeracoes)}
          sub={`${totalRequests} via IA + ${stats.cache.total_hits} via cache`}
          tom="brand"
        />
        <CardTotal
          icone={<Database className="h-5 w-5" />}
          titulo="Taxa de cache"
          valor={`${hitRate}%`}
          sub={`${stats.cache.total_entries} respostas armazenadas`}
          tom="success"
        />
        <CardTotal
          icone={<TrendingUp className="h-5 w-5" />}
          titulo="Tokens economizados"
          valor={fmtK(stats.cache.tokens_economizados_estimados)}
          sub="estimativa por cache hit (~3.5k cada)"
          tom="info"
        />
        <CardTotal
          icone={<Flame className="h-5 w-5" />}
          titulo="Tokens consumidos"
          valor={fmtK(totalTokens)}
          sub={`${providerEntries.length} providers ativos`}
          tom="warn"
        />
      </section>

      {/* Uso por provider */}
      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-card">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-neutral-700">
          Uso por provider (últimos 30 dias)
        </h2>
        <div className="space-y-3">
          {providerEntries
            .sort(([, a], [, b]) => b.tokens - a.tokens)
            .map(([prov, s]) => (
              <div key={prov}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium uppercase tracking-wide text-neutral-700">
                    {prov}
                  </span>
                  <span className="text-neutral-500">
                    {fmtK(s.tokens)} tokens • {s.requests} requisições
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(s.tokens / maxProviderTokens) * 100}%`,
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`h-full ${PROVIDER_COR[prov] || "bg-neutral-500"}`}
                  />
                </div>
              </div>
            ))}
          {providerEntries.length === 0 && (
            <p className="text-xs text-neutral-500">
              Nenhum uso registrado ainda. Gere alguma resposta no app.
            </p>
          )}
        </div>
      </section>

      {/* Sparkline 30 dias */}
      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-card">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-neutral-700">
          Requisições por dia
        </h2>
        <div className="flex h-32 items-end gap-1">
          {stats.serie_30d.map((p) => {
            const altura = (p.total / maxDayTotal) * 100;
            return (
              <div
                key={p.dia}
                className="group relative flex flex-1 flex-col justify-end"
                title={`${p.dia}: ${p.total} req`}
              >
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${altura}%` }}
                  transition={{ duration: 0.4 }}
                  className="rounded-t-sm bg-brand-500/70 transition-colors group-hover:bg-brand-600"
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-neutral-400">
          <span>{stats.serie_30d[0]?.dia}</span>
          <span>hoje</span>
        </div>
      </section>

      {/* Top temas cacheados */}
      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-card">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-neutral-700">
          Top temas reaproveitados pelo cache
        </h2>
        {stats.top_cache_temas.length === 0 ? (
          <p className="text-xs text-neutral-500">
            Nenhum cache hit ainda. Comece a gerar e o ranking aparece aqui.
          </p>
        ) : (
          <ol className="space-y-2">
            {stats.top_cache_temas.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50/40 p-3"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {t.tema || "—"}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {t.disciplina} • {t.etapa}
                  </p>
                </div>
                {t.modo && (
                  <Badge tone="neutral">{MODO_LABEL[t.modo] || t.modo}</Badge>
                )}
                <Badge tone="success">{t.hits} hits</Badge>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Cache por modo */}
      {Object.keys(stats.cache.por_modo).length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-card">
          <h2 className="mb-4 text-sm font-semibold tracking-wide text-neutral-700">
            Respostas armazenadas por tipo
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.cache.por_modo).map(([modo, qtd]) => (
              <Badge key={modo} tone="info">
                {MODO_LABEL[modo] || modo}: {qtd}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function LoginScreen({
  onSucesso,
  onVoltar,
}: {
  onSucesso: (c: AdminCreds) => void;
  onVoltar: () => void;
}) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!user.trim() || !password) return;
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`${API_BASE}/admin/check`, {
        headers: {
          "X-Admin-User": user.trim(),
          "X-Admin-Password": password,
        },
      });
      if (r.status === 401) {
        setErro("Usuário ou senha inválidos");
        return;
      }
      if (!r.ok) {
        setErro(`Erro ${r.status}`);
        return;
      }
      const creds: AdminCreds = { user: user.trim(), password };
      saveCreds(creds);
      onSucesso(creds);
    } catch (e) {
      setErro(`Não foi possível conectar: ${(e as Error).message}`);
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
          <Lock className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
            Acesso administrativo
          </h1>
          <p className="text-sm text-neutral-500">
            Entre com suas credenciais
          </p>
        </div>
      </header>

      <form
        onSubmit={entrar}
        className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-card"
      >
        <Input
          label="Usuário"
          autoComplete="username"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoFocus
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
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
          disabled={!user.trim() || !password}
          className="w-full justify-center"
        >
          Entrar
        </Button>
      </form>
    </div>
  );
}

function CardTotal({
  icone,
  titulo,
  valor,
  sub,
  tom,
}: {
  icone: React.ReactNode;
  titulo: string;
  valor: string;
  sub: string;
  tom: "brand" | "success" | "info" | "warn";
}) {
  const tones: Record<typeof tom, string> = {
    brand: "bg-brand-50 text-brand-700",
    success: "bg-emerald-50 text-emerald-700",
    info: "bg-sky-50 text-sky-700",
    warn: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tom]}`}
        >
          {icone}
        </span>
      </div>
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        {titulo}
      </p>
      <p className="mt-1 text-2xl font-bold text-neutral-900">{valor}</p>
      <p className="mt-1 text-xs text-neutral-500">{sub}</p>
    </div>
  );
}
