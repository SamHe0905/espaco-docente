import { useMemo, useReducer, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Field";
import { StepBlock } from "../components/ui/StepBlock";
import { HabilidadeBox } from "../components/HabilidadeBox";
import { AulaInputRow } from "../components/AulaInput";
import { ResultPane } from "../components/ResultPane";
import {
  DISCIPLINAS,
  ETAPAS,
  EXEMPLOS_TEMA_GENERICOS,
  EXEMPLOS_TEMA_POR_DISCIPLINA,
  MODO_BY_ID,
  SERIES_POR_ETAPA,
} from "../lib/constants";
import { api, ApiError } from "../lib/api";
import { historico } from "../lib/storage";
import type {
  AulaInput as AulaInputT,
  CurriculumHit,
  GenerateRequest,
  GenerateResponse,
  Modo,
} from "../lib/types";

interface FormState {
  etapa: string;
  serie: string;
  disciplina: string;
  tema: string;
  foco_especifico: string;
  codigoBuscaInput: string; // o que o user digitou no campo, antes de "Buscar"
  habilidadesSelecionadas: CurriculumHit[]; // lista de habilidades selecionadas
  buscandoBNCC: boolean;
  aulas: AulaInputT[];
  metodologia: string;
  recursos: string;
  observacoes_turma: string;
  adaptacao_necessaria: string;
  lacuna_aprendizagem: string;
}

type Action =
  | { type: "set"; field: keyof FormState; value: string }
  | { type: "add-habilidade"; hit: CurriculumHit }
  | { type: "remove-habilidade"; codigo: string }
  | { type: "limpar-habilidades" }
  | { type: "set-buscando"; value: boolean }
  | { type: "set-aula"; index: number; aula: AulaInputT }
  | { type: "add-aula" }
  | { type: "remove-aula"; index: number }
  | { type: "limpar" };

function makeInitialState(): FormState {
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    etapa: "",
    serie: "",
    disciplina: "",
    tema: "",
    foco_especifico: "",
    codigoBuscaInput: "",
    habilidadesSelecionadas: [],
    buscandoBNCC: false,
    aulas: [{ data: hoje }],
    metodologia: "",
    recursos: "",
    observacoes_turma: "",
    adaptacao_necessaria: "",
    lacuna_aprendizagem: "",
  };
}

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "add-habilidade": {
      if (state.habilidadesSelecionadas.some((h) => h.codigo === action.hit.codigo))
        return state;
      return {
        ...state,
        habilidadesSelecionadas: [...state.habilidadesSelecionadas, action.hit],
        codigoBuscaInput: "",
      };
    }
    case "remove-habilidade":
      return {
        ...state,
        habilidadesSelecionadas: state.habilidadesSelecionadas.filter(
          (h) => h.codigo !== action.codigo,
        ),
      };
    case "limpar-habilidades":
      return { ...state, habilidadesSelecionadas: [] };
    case "set-buscando":
      return { ...state, buscandoBNCC: action.value };
    case "set-aula": {
      const next = [...state.aulas];
      next[action.index] = action.aula;
      return { ...state, aulas: next };
    }
    case "add-aula":
      if (state.aulas.length >= 5) return state;
      return {
        ...state,
        aulas: [
          ...state.aulas,
          { data: state.aulas[state.aulas.length - 1]?.data || "" },
        ],
      };
    case "remove-aula": {
      if (state.aulas.length <= 1) return state;
      const next = state.aulas.filter((_, i) => i !== action.index);
      return { ...state, aulas: next };
    }
    case "limpar":
      return makeInitialState();
  }
}

interface Props {
  modo: Modo;
  onVoltar: () => void;
}

export function WizardScreen({ modo, onVoltar }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
  const [resultado, setResultado] = useState<GenerateResponse | null>(null);
  const [requestUsado, setRequestUsado] = useState<GenerateRequest | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const modoInfo = MODO_BY_ID[modo];
  const precisaLacuna = modoInfo.precisa?.includes("lacuna");
  const precisaAdaptacao = modoInfo.precisa?.includes("adaptacao");

  const seriesDisponiveis = useMemo(
    () => (state.etapa ? SERIES_POR_ETAPA[state.etapa] || [] : []),
    [state.etapa],
  );

  const exemplosTema = useMemo(
    () =>
      state.disciplina
        ? EXEMPLOS_TEMA_POR_DISCIPLINA[state.disciplina] ||
          EXEMPLOS_TEMA_GENERICOS
        : EXEMPLOS_TEMA_GENERICOS,
    [state.disciplina],
  );

  const podeGerar =
    !!state.etapa &&
    !!state.disciplina &&
    state.tema.trim().length >= 2 &&
    state.aulas.length >= 1 &&
    state.aulas.every((a) => a.data) &&
    (!precisaLacuna || state.lacuna_aprendizagem.trim().length > 0) &&
    (!precisaAdaptacao || state.adaptacao_necessaria.trim().length > 0);

  async function buscarBNCC() {
    const termo = state.codigoBuscaInput.trim() || state.tema.trim();
    if (!termo) return;
    dispatch({ type: "set-buscando", value: true });
    setErro(null);
    try {
      const r = await api.searchBNCC({
        query: termo,
        etapa: state.etapa || null,
        disciplina: state.disciplina || null,
        top_k: 1,
      });
      const hit = r.hits[0] || null;
      if (hit) {
        dispatch({ type: "add-habilidade", hit });
      } else {
        setErro("Nenhuma habilidade encontrada para o termo.");
      }
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao buscar habilidade.");
    } finally {
      dispatch({ type: "set-buscando", value: false });
    }
  }

  async function gerar() {
    setErro(null);
    setGerando(true);
    setResultado(null);
    const req: GenerateRequest = {
      modo,
      etapa: state.etapa,
      serie: state.serie || undefined,
      disciplina: state.disciplina,
      tema: state.tema,
      foco_especifico: state.foco_especifico || undefined,
      codigos_bncc: state.habilidadesSelecionadas.map((h) => h.codigo),
      aulas: state.aulas,
      metodologia: state.metodologia || undefined,
      recursos: state.recursos || undefined,
      observacoes_turma: state.observacoes_turma || undefined,
      adaptacao_necessaria: state.adaptacao_necessaria || undefined,
      lacuna_aprendizagem: state.lacuna_aprendizagem || undefined,
    };
    try {
      const r = await api.generate(req);
      setResultado(r);
      setRequestUsado(req);
      historico.adicionar(req, r);
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? `Erro ${e.status}: ${e.message}`
          : "Falha ao gerar planejamento. Tente novamente em instantes.",
      );
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onVoltar}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
            aria-label="Voltar"
          >
            ←
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-xl">
            {modoInfo.icone}
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              Novo {modoInfo.titulo.toLowerCase()}
            </h1>
            <p className="text-xs text-neutral-500">
              Preencha os dados para gerar seu material.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        {/* COLUNA ESQUERDA — FORM */}
        <div className="space-y-4">
          {/* 1. Dados da turma */}
          <StepBlock numero={1} titulo="Dados da turma">
            <Select
              label="Etapa de Ensino"
              value={state.etapa}
              placeholder="Selecione a etapa"
              onChange={(e) => {
                dispatch({ type: "set", field: "etapa", value: e.target.value });
                dispatch({ type: "set", field: "serie", value: "" });
              }}
              options={ETAPAS.map((e) => ({ value: e, label: e }))}
            />
            {seriesDisponiveis.length > 0 && (
              <Select
                label="Série / Ano"
                value={state.serie}
                placeholder="Selecione a série"
                onChange={(e) =>
                  dispatch({ type: "set", field: "serie", value: e.target.value })
                }
                options={seriesDisponiveis.map((s) => ({ value: s, label: s }))}
              />
            )}
            <Select
              label="Componente Curricular"
              value={state.disciplina}
              placeholder="Selecione a disciplina"
              onChange={(e) =>
                dispatch({ type: "set", field: "disciplina", value: e.target.value })
              }
              options={DISCIPLINAS.map((d) => ({ value: d, label: d }))}
            />
          </StepBlock>

          {/* 2. Tema */}
          <StepBlock numero={2} titulo="Tema / Assunto">
            <Input
              label="Tema principal"
              placeholder={`Ex: ${exemplosTema.join(", ")}`}
              value={state.tema}
              onChange={(e) =>
                dispatch({ type: "set", field: "tema", value: e.target.value })
              }
            />
            <Input
              label="Foco específico (opcional)"
              hint="Ex: aspectos econômicos, impactos no Brasil…"
              placeholder=""
              value={state.foco_especifico}
              onChange={(e) =>
                dispatch({
                  type: "set",
                  field: "foco_especifico",
                  value: e.target.value,
                })
              }
            />
          </StepBlock>

          {/* 3. Habilidade BNCC */}
          <StepBlock
            numero={3}
            titulo="Habilidade BNCC"
            subtitulo="você pode adicionar mais de uma"
          >
            <div className="flex items-end gap-2">
              <Input
                label="Código ou termo"
                hint="Ex: EM13CHS502 — ou um termo como 'globalização'"
                placeholder="EM13CHS502"
                value={state.codigoBuscaInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    buscarBNCC();
                  }
                }}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    field: "codigoBuscaInput",
                    value: e.target.value,
                  })
                }
              />
              <Button
                onClick={buscarBNCC}
                loading={state.buscandoBNCC}
                disabled={
                  !state.codigoBuscaInput.trim() && !state.tema.trim()
                }
              >
                {state.habilidadesSelecionadas.length > 0
                  ? "Adicionar"
                  : "Buscar"}
              </Button>
            </div>

            {state.habilidadesSelecionadas.length > 0 && (
              <div className="space-y-2">
                {state.habilidadesSelecionadas.map((h) => (
                  <HabilidadeBox
                    key={h.codigo}
                    hit={h}
                    onAlterar={() =>
                      dispatch({
                        type: "remove-habilidade",
                        codigo: h.codigo,
                      })
                    }
                  />
                ))}
                {state.habilidadesSelecionadas.length > 1 && (
                  <button
                    onClick={() => dispatch({ type: "limpar-habilidades" })}
                    className="text-xs text-neutral-500 hover:text-red-600"
                  >
                    Remover todas
                  </button>
                )}
              </div>
            )}
          </StepBlock>

          {/* 4. Aulas */}
          <StepBlock
            numero={4}
            titulo="Aulas"
            subtitulo={`Até 5 aulas por vez (${state.aulas.length}/5)`}
          >
            <div className="space-y-2">
              {state.aulas.map((a, i) => (
                <AulaInputRow
                  key={i}
                  numero={i + 1}
                  aula={a}
                  onChange={(next) =>
                    dispatch({ type: "set-aula", index: i, aula: next })
                  }
                  onRemove={
                    state.aulas.length > 1
                      ? () => dispatch({ type: "remove-aula", index: i })
                      : undefined
                  }
                />
              ))}
            </div>
            {state.aulas.length < 5 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => dispatch({ type: "add-aula" })}
                className="w-full justify-center"
              >
                + Adicionar aula
              </Button>
            )}
          </StepBlock>

          {/* 5. Preferências */}
          <StepBlock
            numero={5}
            titulo="Preferências"
            subtitulo="opcional, mas melhora a qualidade do resultado"
          >
            {precisaLacuna && (
              <Textarea
                label="Lacuna de aprendizagem identificada"
                hint="Descreva o que a turma ainda não dominou"
                value={state.lacuna_aprendizagem}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    field: "lacuna_aprendizagem",
                    value: e.target.value,
                  })
                }
                rows={2}
              />
            )}
            {precisaAdaptacao && (
              <Textarea
                label="Adaptação necessária"
                hint="Descreva a necessidade educacional do(s) estudante(s)"
                value={state.adaptacao_necessaria}
                onChange={(e) =>
                  dispatch({
                    type: "set",
                    field: "adaptacao_necessaria",
                    value: e.target.value,
                  })
                }
                rows={2}
              />
            )}
            <Input
              label="Metodologia desejada"
              hint="Ex: aula expositiva, sala invertida, projetos…"
              value={state.metodologia}
              onChange={(e) =>
                dispatch({
                  type: "set",
                  field: "metodologia",
                  value: e.target.value,
                })
              }
            />
            <Input
              label="Recursos disponíveis"
              hint="Ex: quadro, projetor, internet, livros…"
              value={state.recursos}
              onChange={(e) =>
                dispatch({
                  type: "set",
                  field: "recursos",
                  value: e.target.value,
                })
              }
            />
            <Textarea
              label="Observações sobre a turma"
              hint="Algo importante para considerar?"
              value={state.observacoes_turma}
              onChange={(e) =>
                dispatch({
                  type: "set",
                  field: "observacoes_turma",
                  value: e.target.value,
                })
              }
              rows={2}
            />
          </StepBlock>

          <div className="sticky bottom-4 flex gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-card">
            <Button
              variant="ghost"
              onClick={() => {
                dispatch({ type: "limpar" });
                setResultado(null);
                setRequestUsado(null);
                setErro(null);
              }}
              icon={<span>↻</span>}
            >
              Limpar
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={gerar}
              loading={gerando}
              disabled={!podeGerar}
              className="flex-1"
            >
              {gerando ? "Gerando..." : `Gerar ${modoInfo.titulo.toLowerCase()}`}
            </Button>
          </div>

          {erro && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {erro}
            </motion.p>
          )}
        </div>

        {/* COLUNA DIREITA — RESULTADO */}
        <ResultPane
          modo={modo}
          resultado={resultado}
          requestUsado={requestUsado}
          gerando={gerando}
        />
      </div>
    </div>
  );
}
