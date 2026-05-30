import { motion } from "framer-motion";
import { useState } from "react";
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
}

function formataData(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function calcCargaHoraria(qtd: number, minutosPorAula = 50): string {
  const total = qtd * minutosPorAula;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}min`;
}

export function ResultPane({ modo, resultado, requestUsado, gerando }: Props) {
  const [copiado, setCopiado] = useState(false);
  const [salvandoExport, setSalvandoExport] = useState<null | "word" | "pdf">(null);

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

  function handlePDF() {
    if (!resultado || !requestUsado) return;
    setSalvandoExport("pdf");
    try {
      exportToPDF(requestUsado, resultado);
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
          <Button size="sm" onClick={handleCopiar}>
            {copiado ? "✓ Copiado!" : "📋 Copiar"}
          </Button>
          <Button
            size="sm"
            onClick={handlePDF}
            loading={salvandoExport === "pdf"}
          >
            📄 Baixar PDF
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleWord}
            loading={salvandoExport === "word"}
          >
            📝 Baixar Word
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
        <Badge tone="info">
          {resultado.aulas.length} aula{resultado.aulas.length > 1 ? "s" : ""}{" "}
          planejada{resultado.aulas.length > 1 ? "s" : ""}
        </Badge>
        <Badge tone="neutral">Carga horária: {cargaHoraria}</Badge>
      </div>

      <div className="space-y-3">
        {resultado.aulas.map((a) => {
          const palavras = a.palavras;
          const ok = palavras >= 40 && palavras <= 60;
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
                <Badge tone={ok ? "success" : "warn"}>
                  {palavras} palavras
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-neutral-800">
                {a.texto}
              </p>
            </motion.article>
          );
        })}
      </div>

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

      <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        ⚠️ <strong>Aviso.</strong> {resultado.aviso}
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// estados placeholder / loading
// ---------------------------------------------------------------------------

function ResultPlaceholder({ modo }: { modo: Modo }) {
  const m = MODO_BY_ID[modo];
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
      <span className="mb-4 text-5xl opacity-60">{m.icone}</span>
      <h3 className="text-base font-semibold text-neutral-700">
        Resultado aparece aqui
      </h3>
      <p className="mt-2 max-w-xs text-sm text-neutral-500">
        Preencha o formulário ao lado e clique em{" "}
        <span className="font-medium text-brand-700">
          Gerar {m.titulo.toLowerCase()}
        </span>{" "}
        para ver seu material personalizado.
      </p>
    </div>
  );
}

function ResultLoading({ modo }: { modo: Modo }) {
  const m = MODO_BY_ID[modo];
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-card">
      <div className="mb-4 flex items-center gap-3">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          className="text-2xl"
        >
          {m.icone}
        </motion.span>
        <div>
          <p className="text-sm font-medium text-neutral-800">
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
