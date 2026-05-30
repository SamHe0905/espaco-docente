import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { historico } from "../lib/storage";
import { MODO_BY_ID } from "../lib/constants";
import { copiarParaClipboard, exportToPDF, exportToWord } from "../lib/export";
import type { PlanoSalvo } from "../lib/types";

interface Props {
  onVoltar: () => void;
}

export function HistoryScreen({ onVoltar }: Props) {
  const [items, setItems] = useState<PlanoSalvo[]>([]);

  useEffect(() => {
    setItems(historico.listar());
  }, []);

  function remove(id: string) {
    historico.remover(id);
    setItems(historico.listar());
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center gap-3">
        <button
          onClick={onVoltar}
          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
          aria-label="Voltar"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Meu histórico</h1>
          <p className="text-xs text-neutral-500">
            Salvos no seu navegador. {items.length} item(ns).
          </p>
        </div>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              if (confirm("Apagar todo o histórico?")) {
                historico.limpar();
                setItems([]);
              }
            }}
          >
            Limpar tudo
          </Button>
        )}
      </header>

      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-sm text-neutral-500">
            Você ainda não gerou nenhum planejamento. Quando gerar, eles ficam
            aqui.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((p) => {
          const m = MODO_BY_ID[p.request.modo];
          const data = new Date(p.createdAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <li
              key={p.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{m.icone}</span>
                    <h3 className="text-sm font-semibold text-neutral-900">
                      {p.request.tema}
                    </h3>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="brand">{m.titulo}</Badge>
                    {p.request.disciplina && (
                      <Badge tone="neutral">{p.request.disciplina}</Badge>
                    )}
                    {p.request.serie && (
                      <Badge tone="neutral">{p.request.serie}</Badge>
                    )}
                    <Badge tone="info">
                      {p.response.aulas.length} aula
                      {p.response.aulas.length > 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
                <span className="whitespace-nowrap text-xs text-neutral-500">
                  {data}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => copiarParaClipboard(p.response, p.request)}
                >
                  Copiar
                </Button>
                <Button size="sm" onClick={() => exportToPDF(p.request, p.response)}>
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => exportToWord(p.request, p.response)}
                >
                  Word
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  className="ml-auto"
                  onClick={() => remove(p.id)}
                >
                  Apagar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
