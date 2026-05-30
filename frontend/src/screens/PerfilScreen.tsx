/**
 * Painel do professor: lista de atividades salvas no servidor.
 */
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Copy,
  FileDown,
  FileText,
  LogOut,
  Trash2,
  User,
} from "lucide-react";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { api, ApiError } from "../lib/api";
import { MODO_BY_ID } from "../lib/constants";
import { clearAuth } from "../lib/userAuth";
import type { AuthState } from "../lib/userAuth";
import type { PlanoSalvoServer } from "../lib/types";
import {
  copiarParaClipboard,
  exportToPDF,
  exportToWord,
} from "../lib/export";

interface Props {
  auth: AuthState;
  onLogout: () => void;
  onVoltar: () => void;
}

export function PerfilScreen({ auth, onLogout, onVoltar }: Props) {
  const [planos, setPlanos] = useState<PlanoSalvoServer[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .meusPlanos(auth.token)
      .then(setPlanos)
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          clearAuth();
          onLogout();
        } else {
          setErro(e instanceof ApiError ? e.message : String(e));
        }
      });
  }, [auth.token, onLogout]);

  async function excluir(id: number) {
    if (!confirm("Excluir esta atividade do seu perfil?")) return;
    try {
      await api.excluirPlano(auth.token, id);
      setPlanos((prev) => prev?.filter((p) => p.id !== id) ?? null);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : String(e));
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <button
          onClick={onVoltar}
          className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <User className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
            Olá, {auth.user.nome_exibicao || auth.user.username}
          </h1>
          <p className="text-sm text-neutral-500">
            Suas atividades salvas •{" "}
            {planos === null ? "carregando..." : `${planos.length} no total`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearAuth();
            onLogout();
          }}
          icon={<LogOut className="h-4 w-4" />}
        >
          Sair
        </Button>
      </header>

      {erro && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      {planos !== null && planos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center">
          <p className="text-sm text-neutral-500">
            Você ainda não salvou nenhuma atividade.
          </p>
          <p className="mt-2 text-xs text-neutral-400">
            Gere um planejamento e clique em{" "}
            <span className="font-medium text-brand-700">Salvar no perfil</span>{" "}
            no resultado.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={onVoltar}
            className="mt-4"
          >
            Criar nova atividade
          </Button>
        </div>
      )}

      <ul className="space-y-3">
        {planos?.map((p) => {
          const m = MODO_BY_ID[p.modo];
          const Icon = m?.icon;
          const data = new Date(p.criado_em).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <li
              key={p.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {Icon && (
                      <Icon
                        className="h-4 w-4 text-brand-700"
                        strokeWidth={2}
                      />
                    )}
                    <h3 className="truncate text-sm font-semibold text-neutral-900">
                      {p.tema || "—"}
                    </h3>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {m && <Badge tone="brand">{m.titulo}</Badge>}
                    {p.request_json?.disciplina && (
                      <Badge tone="neutral">
                        {p.request_json.disciplina}
                      </Badge>
                    )}
                    {p.request_json?.serie && (
                      <Badge tone="neutral">{p.request_json.serie}</Badge>
                    )}
                  </div>
                </div>
                <span className="whitespace-nowrap text-xs text-neutral-500">
                  {data}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={() =>
                    copiarParaClipboard(p.response_json, p.request_json)
                  }
                >
                  Copiar
                </Button>
                <Button
                  size="sm"
                  icon={<FileDown className="h-4 w-4" />}
                  onClick={() => exportToPDF(p.request_json, p.response_json)}
                >
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<FileText className="h-4 w-4" />}
                  onClick={() => exportToWord(p.request_json, p.response_json)}
                >
                  Word
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  className="ml-auto"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => excluir(p.id)}
                >
                  Excluir
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
