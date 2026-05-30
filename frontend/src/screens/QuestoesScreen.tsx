import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { api, ApiError } from "../lib/api";
import {
  copiarQuestoesParaClipboard,
  exportQuestoesToPDF,
  exportQuestoesToWord,
} from "../lib/export";
import type { QuestaoHit } from "../lib/types";

const AREAS_ENEM = [
  "Linguagens, Codigos e suas Tecnologias",
  "Ciencias Humanas e suas Tecnologias",
  "Ciencias da Natureza e suas Tecnologias",
  "Matematica e suas Tecnologias",
];

const ANOS = Array.from({ length: 2023 - 2009 + 1 }, (_, i) => 2009 + i);

interface Props {
  onVoltar: () => void;
}

export function QuestoesScreen({ onVoltar }: Props) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [anoMin, setAnoMin] = useState<string>("");
  const [anoMax, setAnoMax] = useState<string>("");
  const [topK, setTopK] = useState(8);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [hits, setHits] = useState<QuestaoHit[]>([]);
  const [revelados, setRevelados] = useState<Set<number>>(new Set());

  // selecao acumulativa: persiste atraves de varias buscas
  const [selecionadasMap, setSelecionadasMap] = useState<Map<number, QuestaoHit>>(
    new Map(),
  );
  const selecionadas = useMemo(
    () => Array.from(selecionadasMap.values()).sort((a, b) => {
      if (a.ano !== b.ano) return a.ano - b.ano;
      return a.numero - b.numero;
    }),
    [selecionadasMap],
  );
  const [copiado, setCopiado] = useState(false);
  const [exportando, setExportando] = useState<null | "word" | "pdf">(null);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setErro(null);
    try {
      const r = await api.searchQuestoes({
        query: query.trim(),
        disciplina: area || null,
        ano_min: anoMin ? parseInt(anoMin) : null,
        ano_max: anoMax ? parseInt(anoMax) : null,
        top_k: topK,
      });
      setHits(r.hits);
      if (r.hits.length === 0) setErro("Nenhuma questão encontrada.");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro ao buscar.");
    } finally {
      setLoading(false);
    }
  }

  function toggleGabarito(id: number) {
    setRevelados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelecao(q: QuestaoHit) {
    setSelecionadasMap((prev) => {
      const next = new Map(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.set(q.id, q);
      return next;
    });
  }

  function selecionarTodos() {
    setSelecionadasMap((prev) => {
      const next = new Map(prev);
      hits.forEach((q) => next.set(q.id, q));
      return next;
    });
  }

  function limparSelecao() {
    setSelecionadasMap(new Map());
  }

  const tituloExport = query.trim()
    ? `Lista de Exercícios — ${query.trim()}`
    : "Lista de Exercícios ENEM";

  async function exportarWord() {
    if (selecionadas.length === 0) return;
    setExportando("word");
    try {
      await exportQuestoesToWord(selecionadas, { titulo: tituloExport });
    } finally {
      setExportando(null);
    }
  }
  function exportarPDF() {
    if (selecionadas.length === 0) return;
    setExportando("pdf");
    try {
      exportQuestoesToPDF(selecionadas, { titulo: tituloExport });
    } finally {
      setExportando(null);
    }
  }
  async function copiar() {
    if (selecionadas.length === 0) return;
    await copiarQuestoesParaClipboard(selecionadas, { titulo: tituloExport });
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  const todosSelecionados =
    hits.length > 0 && hits.every((h) => selecionadasMap.has(h.id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6 lg:py-10">
      <header className="mb-6 flex items-start gap-3">
        <button
          onClick={onVoltar}
          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
          aria-label="Voltar"
        >
          ←
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-xl">
          📚
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900">
            Banco de Questões
          </h1>
          <p className="text-xs text-neutral-500">
            Selecione questões reais de ENEM e exporte como lista de
            exercícios pronta.
          </p>
        </div>
      </header>

      <form
        onSubmit={buscar}
        className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-card"
      >
        <Input
          label="O que você quer encontrar?"
          hint="Ex: 'efeito estufa', 'figuras de linguagem', 'matriz energética brasileira'"
          placeholder="digite um tema ou trecho de questão…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Select
              label="Área (opcional)"
              value={area}
              placeholder="Todas as áreas"
              onChange={(e) => setArea(e.target.value)}
              options={AREAS_ENEM.map((a) => ({ value: a, label: a }))}
            />
          </div>
          <Select
            label="Ano mínimo"
            value={anoMin}
            placeholder="—"
            onChange={(e) => setAnoMin(e.target.value)}
            options={ANOS.map((a) => ({ value: String(a), label: String(a) }))}
          />
          <Select
            label="Ano máximo"
            value={anoMax}
            placeholder="—"
            onChange={(e) => setAnoMax(e.target.value)}
            options={ANOS.map((a) => ({ value: String(a), label: String(a) }))}
          />
        </div>
        <div className="flex items-end justify-between gap-3">
          <Select
            label="Quantas mostrar"
            value={String(topK)}
            onChange={(e) => setTopK(parseInt(e.target.value))}
            options={[3, 5, 8, 12, 20].map((n) => ({
              value: String(n),
              label: `${n} questões`,
            }))}
            className="max-w-[180px]"
          />
          <Button
            variant="primary"
            size="lg"
            type="submit"
            loading={loading}
            disabled={query.trim().length < 2}
          >
            Buscar
          </Button>
        </div>
      </form>

      {erro && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {erro}
        </p>
      )}

      {/* Barra de selecao sticky */}
      {selecionadas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-2 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-300 bg-brand-50/90 p-3 shadow-card backdrop-blur"
        >
          <span className="text-sm font-semibold text-brand-900">
            {selecionadas.length} selecionada{selecionadas.length > 1 ? "s" : ""}
          </span>
          <Button size="sm" onClick={copiar}>
            {copiado ? "✓ Copiado!" : "📋 Copiar"}
          </Button>
          <Button
            size="sm"
            onClick={exportarPDF}
            loading={exportando === "pdf"}
          >
            📄 Baixar PDF
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={exportarWord}
            loading={exportando === "word"}
          >
            📝 Baixar Word
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={limparSelecao}
            className="ml-auto"
          >
            Limpar seleção
          </Button>
        </motion.div>
      )}

      {hits.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            <span>{hits.length} questão(ões) encontrada(s).</span>
            <button
              onClick={todosSelecionados ? limparSelecao : selecionarTodos}
              className="font-medium text-brand-700 hover:underline"
            >
              {todosSelecionados
                ? "Desmarcar todas"
                : "Selecionar todas desta busca"}
            </button>
          </div>
          {hits.map((q) => (
            <QuestaoCard
              key={q.id}
              q={q}
              revelado={revelados.has(q.id)}
              selecionado={selecionadasMap.has(q.id)}
              onToggleGabarito={() => toggleGabarito(q.id)}
              onToggleSelecao={() => toggleSelecao(q)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestaoCard({
  q,
  revelado,
  selecionado,
  onToggleGabarito,
  onToggleSelecao,
}: {
  q: QuestaoHit;
  revelado: boolean;
  selecionado: boolean;
  onToggleGabarito: () => void;
  onToggleSelecao: () => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={
        "rounded-xl border bg-white p-5 shadow-card transition-colors " +
        (selecionado
          ? "border-brand-400 ring-2 ring-brand-100"
          : "border-neutral-200")
      }
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <label className="mr-1 inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={selecionado}
            onChange={onToggleSelecao}
            className="h-4 w-4 cursor-pointer accent-brand-600"
            aria-label="Selecionar questão"
          />
          <span className="text-xs font-medium text-neutral-600">
            {selecionado ? "Selecionada" : "Selecionar"}
          </span>
        </label>
        <Badge tone="brand">
          {q.vestibular} {q.ano}
        </Badge>
        <Badge tone="neutral">Questão {q.numero}</Badge>
        {q.disciplina && <Badge tone="info">{q.disciplina}</Badge>}
        {q.idioma && <Badge tone="neutral">Idioma: {q.idioma}</Badge>}
        <span className="ml-auto text-xs text-neutral-400">
          relevância {(q.similarity * 100).toFixed(0)}%
        </span>
      </header>

      {q.contexto && (
        <div className="mb-3 whitespace-pre-line rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
          {q.contexto}
        </div>
      )}

      <p className="mb-3 text-sm font-medium text-neutral-900">{q.enunciado}</p>

      <ol className="space-y-1.5">
        {q.alternativas.map((a) => {
          const isCorrect =
            revelado && a.letter.toUpperCase() === q.gabarito.toUpperCase();
          return (
            <li
              key={a.letter}
              className={
                "flex gap-2 rounded-md px-2 py-1 text-sm " +
                (isCorrect
                  ? "bg-emerald-50 text-emerald-900"
                  : "text-neutral-700")
              }
            >
              <span className="font-semibold">{a.letter})</span>
              <span>{a.text}</span>
              {isCorrect && <span className="ml-auto text-emerald-700">✓</span>}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={onToggleGabarito}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          {revelado ? "Ocultar gabarito" : "Ver gabarito"}
        </button>
        {revelado && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            Gabarito: {q.gabarito}
          </span>
        )}
      </div>
    </motion.article>
  );
}
