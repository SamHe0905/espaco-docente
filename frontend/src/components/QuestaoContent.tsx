/**
 * Renderiza o contexto/enunciado de uma questao ENEM, transformando:
 * - markdown ![alt](url) em <img>
 * - placeholder de imagem quebrada da API ENEM em mensagem discreta
 * - mantem texto normal com preservacao de quebras de linha
 */
import { useState } from "react";
import { ImageOff } from "lucide-react";

const MD_IMAGE = /!\[(.*?)\]\((.+?)\)/g;

function isBroken(url: string): boolean {
  return /broken-?image/i.test(url);
}

interface Segment {
  kind: "text" | "image";
  value: string; // text content OR image url
  alt?: string;
}

function parse(content: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(MD_IMAGE)) {
    const [whole, alt, url] = match;
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      segments.push({ kind: "text", value: content.slice(lastIndex, idx) });
    }
    segments.push({ kind: "image", value: url, alt });
    lastIndex = idx + whole.length;
  }
  if (lastIndex < content.length) {
    segments.push({ kind: "text", value: content.slice(lastIndex) });
  }
  return segments;
}

export function QuestaoContent({ content }: { content: string }) {
  const segments = parse(content);

  return (
    <div className="space-y-3">
      {segments.map((s, i) => {
        if (s.kind === "image") {
          if (isBroken(s.value)) return <BrokenImage key={i} />;
          return <ImageSegment key={i} url={s.value} alt={s.alt} />;
        }
        const trimmed = s.value.trim();
        if (!trimmed) return null;
        return (
          <p
            key={i}
            className="whitespace-pre-line text-sm leading-relaxed text-neutral-700"
          >
            {s.value}
          </p>
        );
      })}
    </div>
  );
}

function ImageSegment({ url, alt }: { url: string; alt?: string }) {
  const [erro, setErro] = useState(false);
  if (erro) return <BrokenImage />;
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <img
        src={url}
        alt={alt || "Figura da questão"}
        className="mx-auto max-h-96 w-auto"
        loading="lazy"
        onError={() => setErro(true)}
      />
    </div>
  );
}

function BrokenImage() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
      <ImageOff className="h-4 w-4" />
      <span>Imagem original da questão não disponível.</span>
    </div>
  );
}
