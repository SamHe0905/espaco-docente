import { motion } from "framer-motion";
import { MODOS } from "../lib/constants";
import type { Modo } from "../lib/types";
import { historico } from "../lib/storage";
import { useEffect, useState } from "react";

interface Props {
  onEscolher: (modo: Modo) => void;
  onAbrirHistorico: () => void;
}

export function HomeScreen({ onEscolher, onAbrirHistorico }: Props) {
  const [qtdHistorico, setQtdHistorico] = useState(0);
  useEffect(() => {
    setQtdHistorico(historico.listar().length);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">
            📘
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">
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
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
          >
            📄 Meu histórico
            <span className="rounded-full bg-neutral-100 px-1.5 text-xs">
              {qtdHistorico}
            </span>
          </button>
        )}
      </header>

      <div className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-neutral-900">
          O que vamos planejar hoje?
        </h2>
        <p className="text-sm text-neutral-500">
          Escolha o tipo de material que deseja gerar. Você poderá ajustar tudo
          antes de exportar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODOS.map((m, i) => (
          <motion.button
            key={m.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            whileHover={{ y: -2 }}
            onClick={() => onEscolher(m.id)}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-card transition-all hover:border-brand-300 hover:shadow-card-hover"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-xl transition-colors group-hover:bg-brand-100">
              {m.icone}
            </span>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                {m.titulo}
              </h3>
              <p className="mt-1 text-sm text-neutral-500">{m.descricao}</p>
            </div>
            <span className="mt-auto text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
              Começar →
            </span>
          </motion.button>
        ))}
      </div>

      <footer className="mt-12 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs text-neutral-600">
          <strong>Aviso ético.</strong> O Espaço Docente sugere conteúdos
          pedagógicos com apoio de IA. O professor permanece como mediador
          principal do processo educativo. Sempre revise as sugestões antes
          de usar em sala.
        </p>
      </footer>
    </div>
  );
}
