import { clsx } from "clsx";
import { CalendarDays, GripVertical, X } from "lucide-react";
import { useRef } from "react";

import { Button } from "./ui/Button";
import type { AulaInput as AulaInputT } from "../lib/types";

interface Props {
  numero: number;
  aula: AulaInputT;
  onChange: (next: AulaInputT) => void;
  onRemove?: () => void;
}

function formatLabel(data: string): string {
  if (!data) return "Escolher data";
  const [, m, d] = data.split("-");
  return `${d}/${m}`;
}

export function AulaInputRow({ numero, aula, onChange, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Abre o calendario nativo. showPicker() requer interacao do usuario
  // (estamos dentro de um onClick), o que satisfaz o navegador.
  function abrirCalendario(e: React.MouseEvent) {
    // Evita conflito com o botao remover
    if ((e.target as HTMLElement).closest("button")) return;
    const el = inputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      // alguns navegadores ainda nao suportam showPicker — fallback foca
      el.focus();
      el.click();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={abrirCalendario}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.showPicker?.();
        }
      }}
      className={clsx(
        "flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2",
        "transition-colors hover:border-brand-300 hover:bg-brand-50/30",
      )}
      aria-label={`Aula ${numero} — clique para escolher data`}
    >
      <span aria-hidden className="text-neutral-400">
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="text-sm font-medium text-brand-700">Aula {numero}</span>
      <span className="text-sm text-neutral-400">•</span>
      <span className="flex-1 text-sm text-neutral-700">
        {formatLabel(aula.data)}
      </span>

      <CalendarDays
        aria-hidden
        className="h-4 w-4 text-neutral-400"
      />

      {/* Input invisivel mas funcional — usado via showPicker() */}
      <input
        ref={inputRef}
        type="date"
        value={aula.data}
        onChange={(e) => onChange({ ...aula, data: e.target.value })}
        className="sr-only"
        tabIndex={-1}
        aria-label={`Data da aula ${numero}`}
      />

      {onRemove && (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remover aula ${numero}`}
          className="!px-2"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
