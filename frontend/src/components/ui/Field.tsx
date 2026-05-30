import { clsx } from "clsx";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

interface LabelWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function FieldLabel({ label, hint, error, children }: LabelWrapperProps) {
  return (
    <label className="block space-y-1">
      {label && (
        <span className="block text-sm font-medium text-neutral-700">
          {label}
        </span>
      )}
      {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
      {children}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const baseInput =
  "block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 " +
  "shadow-sm transition-colors placeholder:text-neutral-400 " +
  "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 " +
  "disabled:cursor-not-allowed disabled:bg-neutral-50";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}
export function Input({ label, hint, error, className, ...rest }: InputProps) {
  return (
    <FieldLabel label={label} hint={hint} error={error}>
      <input className={clsx(baseInput, className)} {...rest} />
    </FieldLabel>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}
export function Textarea({ label, hint, error, className, rows = 3, ...rest }: TextareaProps) {
  return (
    <FieldLabel label={label} hint={hint} error={error}>
      <textarea
        rows={rows}
        className={clsx(baseInput, "resize-y", className)}
        {...rest}
      />
    </FieldLabel>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}
export function Select({
  label,
  hint,
  error,
  options,
  placeholder,
  className,
  ...rest
}: SelectProps) {
  return (
    <FieldLabel label={label} hint={hint} error={error}>
      <select
        className={clsx(baseInput, "appearance-none pr-10 bg-no-repeat", className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%236b7280' stroke-width='1.5'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5'/%3E%3C/svg%3E\")",
          backgroundPosition: "right 0.75rem center",
        }}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldLabel>
  );
}
