import { clsx } from "clsx";

interface Option {
  value: string;
  label: string;
  description?: string;
}

interface Props {
  label: string;
  hint?: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  name?: string;
}

export function RadioGroup({ label, hint, value, options, onChange, name }: Props) {
  const groupName = name || `radio-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 block text-sm font-medium text-neutral-700">
        {label}
      </legend>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <label
              key={o.value}
              className={clsx(
                "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                selected
                  ? "border-brand-400 bg-brand-50 ring-2 ring-brand-100"
                  : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50",
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={o.value}
                checked={selected}
                onChange={() => onChange(o.value)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-brand-600"
              />
              <span>
                <span className="block text-sm font-medium text-neutral-900">
                  {o.label}
                </span>
                {o.description && (
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {o.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
