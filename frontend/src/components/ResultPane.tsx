import { motion } from "framer-motion";
import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  FileDown,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { AuthState } from "../lib/userAuth";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { MODO_BY_ID } from "../lib/constants";
import {
  copiarParaClipboard,
  exportToPDF,
  exportToWord,
} from "../lib/export";
import type {
  GenerateRequest,
  GenerateResponse,
  Modo,
} from "../lib/types";

interface Props {
  modo: Modo;
  resultado: GenerateResponse | null;
  requestUsado: GenerateRequest | null;
  gerando: boolean;
  onRegerar?: () => void;
  auth?: AuthState | null;
  onPrecisaLogin?: () => void;
}

function formataData(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// Renderiza o texto da aula: linhas que comecam com '## ' viram subtitulos
// em negrito; demais linhas viram paragrafos justificados. Linhas vazias
// viram espacador. Convencao usada pelo modo roteiro detalhado.
function TextoFormatado({ texto }: { texto: string }) {
  const linhas = texto.split(/\n/);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-neutral-800">
      {linhas.map((linha, i) => {
        const headingMatch = linha.match(/^##\s+(.*)$/);
        if (headingMatch) {
          return (
            <h3
              key={i}
              className="pt-2 text-sm font-bold text-neutral-900"
            >
              {headingMatch[1].trim()}
            </h3>
          );
        }
        if (!linha.trim()) {
          return <div key={i} className="h-1" />;
        }
        return (
          <p key={i} className="text-justify">
            {linha}
          </p>
        );
      })}
    </div>
  );
}

function calcCargaHoraria(qtd: number, minutosPorAula = 50): string {
  const total = qtd * minutosPorAula;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}min`;
}

export function ResultPane({ modo, resultado, requestUsado, gerando, onRegerar, auth, onPrecisaLogin }: Props) {
  const [copiado, setCopiado] = useState(false);
  const [salvandoExport, setSalvandoExport] = useState<null | "word" | "pdf">(null);
  const [salvouPerfil, setSalvouPerfil] = useState(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  async function handleSalvarPerfil() {
    if (!resultado || !requestUsado) return;
    if (!auth) {
      onPrecisaLogin?.();
      return;
    }
    setSalvandoPerfil(true);
    try {
      await api.salvarPlano(auth.token, {
        modo: modo,
        tema: requestUsado.tema || null,
        request_json: requestUsado,
        response_json: resultado,
      });
      setSalvouPerfil(true);
      setTimeout(() => setSalvouPerfil(false), 2500);
    } catch (e) {
      alert(
        e instanceof ApiError
          ? `Erro ao salvar: ${e.message}`
          : "Não foi possível salvar",
      );
    } finally {
      setSalvandoPerfil(false);
    }
  }

  if (gerando) return <ResultLoading modo={modo} />;
  if (!resultado || !requestUsado) return <ResultPlaceholder modo={modo} />;

  const modoInfo = MODO_BY_ID[modo];
  const cargaHoraria = calcCargaHoraria(resultado.aulas.length);

  async function handleCopiar() {
    if (!resultado || !requestUsado) return;
    await copiarParaClipboard(resultado, requestUsado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  async function handleWord() {
    if (!resultado || !requestUsado) return;
    setSalvandoExport("word");
    try {
      await exportToWord(requestUsado, resultado);
    } finally {
      setSalvandoExport(null);
    }
  }

  async function handlePDF() {
    if (!resultado || !requestUsado) return;
    setSalvandoExport("pdf");
    try {
      await exportToPDF(requestUsado, resultado);
    } finally {
      setSalvandoExport(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-card lg:p-8"
    >
      <header className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs text-neutral-500">
            Resultado — {modoInfo.titulo}
          </p>
          <h2 className="mt-1 text-xl font-bold text-neutral-900 lg:text-2xl">
            {requestUsado.tema}
            {requestUsado.foco_especifico && (
              <span className="text-neutral-500">
                : {requestUsado.foco_especifico}
              </span>
            )}
          </h2>
          <p className="mt-2 text-xs text-neutral-500">
            {[requestUsado.disciplina, requestUsado.serie, requestUsado.etapa]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRegerar && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRegerar}
              icon={<RefreshCw className="h-4 w-4" />}
              title="Gerar uma versão nova sem usar cache"
            >
              Regerar
            </Button>
          )}
          <Button
            size="sm"
            variant={salvouPerfil ? "ghost" : "secondary"}
            onClick={handleSalvarPerfil}
            loading={salvandoPerfil}
            icon={salvouPerfil ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            title={auth ? "Salvar no meu perfil" : "Entrar pra salvar"}
          >
            {salvouPerfil ? "Salvo!" : auth ? "Salvar no perfil" : "Entrar e salvar"}
          </Button>
          <Button
            size="sm"
            onClick={handleCopiar}
            icon={copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          >
            {copiado ? "Copiado" : "Copiar"}
          </Button>
          <Button
            size="sm"
            onClick={handlePDF}
            loading={salvandoExport === "pdf"}
            icon={<FileDown className="h-4 w-4" />}
          >
            PDF
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleWord}
            loading={salvandoExport === "word"}
            icon={<FileText className="h-4 w-4" />}
          >
            Word
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 py-4">
        {(requestUsado.codigos_bncc || []).map((c) => (
          <Badge tone="brand" key={c}>
            Habilidade: {c}
          </Badge>
        ))}
        {requestUsado.codigo_bncc && (
          <Badge tone="brand">Habilidade: {requestUsado.codigo_bncc}</Badge>
        )}
        {resultado.fonte && resultado.fonte !== "llm" ? (
          <Badge tone="success">
            <Database className="mr-1 inline h-3 w-3" />
            {resultado.fonte === "cache_exato"
              ? "Reaproveitado"
              : "Reaproveitado (similar)"}
          </Badge>
        ) : resultado.fonte === "llm" ? (
          <Badge tone="info">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Gerado agora
          </Badge>
        ) : null}
        {modo === "projetos_e_trabalhos" ? (
          <Badge tone="info">Esqueleto de projeto</Badge>
        ) : (
          <>
            <Badge tone="info">
              {resultado.aulas.length} aula
              {resultado.aulas.length > 1 ? "s" : ""}{" "}
              planejada{resultado.aulas.length > 1 ? "s" : ""}
            </Badge>
            <Badge tone="neutral">Carga horária: {cargaHoraria}</Badge>
          </>
        )}
      </div>

      {/* Plano breve: texto corrido com todas as aulas em sequencia
          (formato pronto pra copiar no sistema da escola) */}
      {modo === "plano_de_aula" && resultado.aulas.length > 0 ? (
        <motion.article
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-neutral-200 bg-white p-5"
        >
          <p className="text-sm leading-relaxed text-neutral-800">
            {resultado.aulas.map((a, i) => {
              const cabecalho = `Aula ${a.numero} | Habilidade: ${a.codigo_bncc || "—"} | ${formataData(a.data)} | `;
              return (
                <span key={a.numero}>
                  {i > 0 && " "}
                  <span className="font-medium">{cabecalho}</span>
                  {a.texto.trim()}
                  {!a.texto.trim().endsWith(".") ? "." : ""}
                </span>
              );
            })}
          </p>
        </motion.article>
      ) : (
        <div className="space-y-3">
          {resultado.aulas.map((a) => {
            const palavras = a.palavras;
            // Modo projeto: documento unico, sem pilulas de aula/data/codigo
            if (modo === "projetos_e_trabalhos") {
            return (
              <motion.article
                key={a.numero}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-neutral-200 bg-white p-5"
              >
                <TextoFormatado texto={a.texto} />
                <div className="mt-3 text-right">
                  <Badge tone="neutral">{palavras} palavras</Badge>
                </div>
              </motion.article>
            );
          }
            return (
              <motion.article
                key={a.numero}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="brand">Aula {a.numero}</Badge>
                  {a.codigo_bncc && (
                    <Badge tone="neutral">{a.codigo_bncc}</Badge>
                  )}
                  <Badge tone="neutral">{formataData(a.data)}</Badge>
                  <Badge tone="neutral">{palavras} palavras</Badge>
                </div>
                <TextoFormatado texto={a.texto} />
              </motion.article>
            );
          })}
        </div>
      )}

      {resultado.habilidades_usadas.length > 0 && (
        <details className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-neutral-700">
            Habilidades curriculares usadas como referência (
            {resultado.habilidades_usadas.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {resultado.habilidades_usadas.map((h) => (
              <li key={h.codigo} className="text-xs text-neutral-600">
                <span className="font-mono font-semibold text-brand-700">
                  {h.codigo}
                </span>
                {" — "}
                <span>{(h.habilidades || h.texto).slice(0, 200)}…</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-6 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <p>
          <span className="font-semibold">Aviso.</span> {resultado.aviso}
        </p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// estados placeholder / loading
// ---------------------------------------------------------------------------

function ResultPlaceholder({ modo }: { modo: Modo }) {
  const m = MODO_BY_ID[modo];
  const Icon = m.icon;
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-semibold text-neutral-700">
        O resultado aparece aqui
      </h3>
      <p className="mt-2 max-w-xs text-sm text-neutral-500">
        Preencha o formulário ao lado e clique em{" "}
        <span className="font-medium text-brand-700">
          {m.titulo}
        </span>{" "}
        para gerar.
      </p>
    </div>
  );
}

function ResultLoading({ modo }: { modo: Modo }) {
  const m = MODO_BY_ID[modo];
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-card">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-900">
            Gerando {m.titulo.toLowerCase()}…
          </p>
          <p className="text-xs text-neutral-500">
            Buscando habilidades, organizando contexto e redigindo.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/40 p-4"
          >
            <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-full animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-4/6 animate-pulse rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
