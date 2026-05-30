import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { api, ApiError } from "../lib/api";
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

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setErro(null);
    setRevelados(new Set());
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
            Busca semântica em questões reais de ENEM (2009–2023) por tema.
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

      {hits.length > 0 && (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-neutral-600">
            {hits.length} questão(ões) encontrada(s). Clique em
            <span className="mx-1 font-medium text-brand-700">Ver gabarito</span>
            para revelar a resposta.
          </p>
          {hits.map((q) => (
            <QuestaoCard
              key={q.id}
              q={q}
              revelado={revelados.has(q.id)}
              onToggle={() => toggleGabarito(q.id)}
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
  onToggle,
}: {
  q: QuestaoHit;
  revelado: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card"
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
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
          const isCorrect = revelado && a.letter.toUpperCase() === q.gabarito.toUpperCase();
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
          onClick={onToggle}
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
