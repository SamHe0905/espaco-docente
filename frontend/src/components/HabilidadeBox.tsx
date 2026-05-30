import { motion } from "framer-motion";
import type { CurriculumHit } from "../lib/types";

interface Props {
  hit: CurriculumHit;
  onAlterar: () => void;
}

export function HabilidadeBox({ hit, onAlterar }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-emerald-800">
          Habilidade encontrada — {hit.codigo}
        </span>
        <button
          onClick={onAlterar}
          className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
        >
          Alterar habilidade
        </button>
      </div>
      <p className="text-sm leading-relaxed text-emerald-900">
        {hit.habilidades || hit.texto}
      </p>
      <p className="text-xs text-emerald-700/80">
        {hit.disciplina} • {hit.serie || hit.etapa}
      </p>
    </motion.div>
  );
}
