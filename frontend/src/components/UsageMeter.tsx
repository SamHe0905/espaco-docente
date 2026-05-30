/**
 * Widget flutuante no canto inferior direito com o uso atual da chain
 * de providers LLM. Compacto por padrao (status agregado); expande no clique
 * pra mostrar TPM/RPM e TPD/RPD por provider.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";

import { clsx } from "clsx";

interface ProviderStats {
  rpm: number;
  tpm: number;
  rpd: number;
  tpd: number;
  limits: {
    rpm?: number | null;
    tpm?: number | null;
    rpd?: number | null;
    tpd?: number | null;
  };
}
interface Snapshot {
  providers: Record<string, ProviderStats>;
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const REFRESH_MS = 10_000;

const PROVIDER_LABEL: Record<string, string> = {
  groq: "Groq",
  cerebras: "Cerebras",
  gemini: "Gemini",
};

function pct(used: number, limit?: number | null): number | null {
  if (!limit) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}

function corFaixa(p: number | null): string {
  if (p === null) return "bg-neutral-200";
  if (p >= 90) return "bg-red-500";
  if (p >= 70) return "bg-amber-500";
  if (p >= 40) return "bg-brand-500";
  return "bg-emerald-500";
}

export function UsageMeter() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [expandido, setExpandido] = useState(false);

  useEffect(() => {
    let cancelado = false;
    async function poll() {
      try {
        const r = await fetch(`${API_BASE}/llm-usage`);
        if (!r.ok) return;
        const data: Snapshot = await r.json();
        if (!cancelado) setSnap(data);
      } catch {
        // backend offline; nao polui UI
      }
    }
    poll();
    const id = setInterval(poll, REFRESH_MS);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, []);

  if (!snap) return null;
  const providers = Object.entries(snap.providers);
  if (providers.length === 0) return null;

  // Pega o "pior caso" entre os providers pra mostrar agregado quando fechado
  let piorPct = 0;
  for (const [, s] of providers) {
    const candidatos = [
      pct(s.rpm, s.limits.rpm),
      pct(s.tpm, s.limits.tpm),
      pct(s.rpd, s.limits.rpd),
      pct(s.tpd, s.limits.tpd),
    ].filter((v): v is number => v !== null);
    for (const v of candidatos) if (v > piorPct) piorPct = v;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <motion.button
        onClick={() => setExpandido((e) => !e)}
        whileHover={{ y: -1 }}
        className={clsx(
          "flex items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur transition-colors",
          "hover:border-neutral-300",
        )}
        aria-label="Uso da IA"
      >
        <span className="relative flex h-2 w-2">
          <span
            className={clsx(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              corFaixa(piorPct),
            )}
          />
          <span
            className={clsx("relative inline-flex h-2 w-2 rounded-full", corFaixa(piorPct))}
          />
        </span>
        <Activity className="h-3 w-3 text-neutral-500" />
        <span className="font-medium text-neutral-700">
          IA · {piorPct}%
        </span>
        {expandido ? (
          <ChevronDown className="h-3 w-3 text-neutral-400" />
        ) : (
          <ChevronUp className="h-3 w-3 text-neutral-400" />
        )}
      </motion.button>

      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 w-80 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl"
          >
            <header className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-neutral-900">
                Uso da IA
              </h3>
              <span className="text-[10px] text-neutral-400">
                atualiza a cada {REFRESH_MS / 1000}s
              </span>
            </header>
            <ul className="space-y-3">
              {providers.map(([name, s]) => (
                <li key={name} className="rounded-lg bg-neutral-50/60 p-2">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
                    {PROVIDER_LABEL[name] || name}
                  </p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                    <Metric
                      label="RPM"
                      used={s.rpm}
                      limit={s.limits.rpm}
                      fmt={(n) => n.toString()}
                    />
                    <Metric
                      label="TPM"
                      used={s.tpm}
                      limit={s.limits.tpm}
                      fmt={fmtK}
                    />
                    <Metric
                      label="RPD"
                      used={s.rpd}
                      limit={s.limits.rpd}
                      fmt={(n) => n.toString()}
                    />
                    <Metric
                      label="TPD"
                      used={s.tpd}
                      limit={s.limits.tpd}
                      fmt={fmtK}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-neutral-400">
              Quando um provider esgota, a cadeia tenta o próximo automaticamente.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Metric({
  label,
  used,
  limit,
  fmt,
}: {
  label: string;
  used: number;
  limit?: number | null;
  fmt: (n: number) => string;
}) {
  const p = pct(used, limit);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-neutral-500">{label}</span>
        <span className="font-medium text-neutral-800">
          {fmt(used)}
          {limit ? (
            <span className="text-neutral-400"> / {fmt(limit)}</span>
          ) : (
            <span className="text-neutral-400"> / ∞</span>
          )}
        </span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-neutral-200">
        <div
          className={clsx("h-full transition-all", corFaixa(p))}
          style={{ width: `${p ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}
