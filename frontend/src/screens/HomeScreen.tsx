import { motion } from "framer-motion";
import { ArrowUpRight, BookOpen, History } from "lucide-react";
import { useEffect, useState } from "react";

import {
  BANCO_QUESTOES_INFO,
  MODOS_VISIVEIS,
} from "../lib/constants";
import type { Modo } from "../lib/types";
import { historico } from "../lib/storage";

interface Props {
  onEscolher: (modo: Modo) => void;
  onAbrirHistorico: () => void;
  onAbrirBancoQuestoes: () => void;
}

export function HomeScreen({
  onEscolher,
  onAbrirHistorico,
  onAbrirBancoQuestoes,
}: Props) {
  const [qtdHistorico, setQtdHistorico] = useState(0);
  useEffect(() => {
    setQtdHistorico(historico.listar().length);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
      {/* Topbar */}
      <header className="mb-14 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <BookOpen className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
              Espaço Docente
            </h1>
            <p className="text-sm text-neutral-500">
              Apoio inteligente ao planejamento pedagógico
            </p>
          </div>
        </div>
        {qtdHistorico > 0 && (
          <button
            onClick={onAbrirHistorico}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            <History className="h-4 w-4 text-neutral-500" />
            Meu histórico
            <span className="rounded-full bg-neutral-100 px-1.5 text-xs">
              {qtdHistorico}
            </span>
          </button>
        )}
      </header>

      {/* Hero */}
      <div className="mb-10 max-w-2xl">
        <h2 className="mb-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
          O que vamos planejar hoje?
        </h2>
        <p className="text-base leading-relaxed text-neutral-600">
          Escolha o tipo de material que deseja gerar. Tudo pode ser ajustado
          antes de exportar para Word ou PDF.
        </p>
      </div>

      {/* Grid de modos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODOS_VISIVEIS.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              whileHover={{ y: -3 }}
              onClick={() => onEscolher(m.id)}
              className="group relative flex h-full flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 text-left transition-shadow hover:border-neutral-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-100">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <ArrowUpRight
                  className="h-4 w-4 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-600"
                  strokeWidth={2}
                />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900">
                  {m.titulo}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                  {m.descricao}
                </p>
              </div>
            </motion.button>
          );
        })}

        {/* Card especial: banco de questoes */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: MODOS_VISIVEIS.length * 0.04, duration: 0.25 }}
          whileHover={{ y: -3 }}
          onClick={onAbrirBancoQuestoes}
          className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-white p-6 text-left transition-shadow hover:border-brand-400 hover:shadow-lg"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700 transition-colors group-hover:bg-brand-200">
              <BANCO_QUESTOES_INFO.icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <ArrowUpRight
              className="h-4 w-4 text-brand-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-700"
              strokeWidth={2}
            />
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-900">
              {BANCO_QUESTOES_INFO.titulo}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
              {BANCO_QUESTOES_INFO.descricao}
            </p>
          </div>
        </motion.button>
      </div>

      {/* Aviso etico */}
      <footer className="mt-16 rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900">Sobre o uso.</span>{" "}
          O Espaço Docente sugere conteúdos pedagógicos com apoio de IA. O
          professor permanece como mediador principal do processo educativo —
          sempre revise as sugestões antes de usar em sala.
        </p>
      </footer>
    </div>
  );
}
