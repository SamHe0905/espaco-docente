import { clsx } from "clsx";
import type { ReactNode } from "react";

type Tone = "neutral" | "brand" | "success" | "info" | "warn";

const tones: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-700",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-emerald-50 text-emerald-700",
  info: "bg-sky-50 text-sky-700",
  warn: "bg-amber-50 text-amber-700",
};

interface Props {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}
export function Badge({ tone = "neutral", children, className }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
