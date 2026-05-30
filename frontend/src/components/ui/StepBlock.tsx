import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  numero: number;
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}

export function StepBlock({ numero, titulo, subtitulo, children }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card"
    >
      <header className="mb-4 flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-700"
        >
          {numero}
        </span>
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{titulo}</h2>
          {subtitulo && (
            <p className="text-xs text-neutral-500">{subtitulo}</p>
          )}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </motion.section>
  );
}
