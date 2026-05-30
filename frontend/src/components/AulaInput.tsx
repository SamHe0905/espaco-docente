import { clsx } from "clsx";
import { GripVertical, X } from "lucide-react";
import { Button } from "./ui/Button";
import type { AulaInput as AulaInputT } from "../lib/types";

interface Props {
  numero: number;
  aula: AulaInputT;
  onChange: (next: AulaInputT) => void;
  onRemove?: () => void;
}

function formatLabel(data: string): string {
  if (!data) return "—/—";
  const [, m, d] = data.split("-");
  return `${d}/${m}`;
}

export function AulaInputRow({ numero, aula, onChange, onRemove }: Props) {
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2",
        "hover:border-neutral-300 transition-colors",
      )}
    >
      <span aria-hidden className="text-neutral-400">
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="text-sm font-medium text-brand-700">
        Aula {numero}
      </span>
      <span className="text-sm text-neutral-400">•</span>
      <span className="text-sm text-neutral-600">{formatLabel(aula.data)}</span>

      <input
        type="date"
        value={aula.data}
        onChange={(e) => onChange({ ...aula, data: e.target.value })}
        className="ml-auto rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200"
        aria-label={`Data da aula ${numero}`}
      />

      {onRemove && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          aria-label={`Remover aula ${numero}`}
          className="!px-2"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
