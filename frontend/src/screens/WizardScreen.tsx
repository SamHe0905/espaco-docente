import { useMemo, useReducer, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Field";
import { RadioGroup } from "../components/ui/RadioGroup";
import { StepBlock } from "../components/ui/StepBlock";
import { HabilidadeBox } from "../components/HabilidadeBox";
import { AulaInputRow } from "../components/AulaInput";
import { ResultPane } from "../components/ResultPane";
import {
  ETAPAS,
  EXEMPLOS_TEMA_GENERICOS,
  EXEMPLOS_TEMA_POR_DISCIPLINA,
  MODO_BY_ID,
  SERIES_POR_ETAPA,
  WIZARD_CONFIG_POR_MODO,
  disciplinasParaEtapa,
  getEffectiveWizardConfig,
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
  codigoBuscaInput: string;
  habilidadesSelecionadas: CurriculumHit[];
  buscandoBNCC: boolean;
  // resultados da ultima busca, pra o user escolher quais adicionar
  resultadosBusca: CurriculumHit[];
  buscaJaExecutada: boolean;
  aulas: AulaInputT[];
  metodologia: string;
  recursos: string;
  observacoes_turma: string;
  // mapa flexivel pros campos extras
  extras: Record<string, string>;
}

type Action =
  | { type: "set"; field: keyof Omit<FormState, "extras" | "resultadosBusca" | "habilidadesSelecionadas" | "buscaJaExecutada" | "aulas">; value: string }
  | { type: "set-extra"; key: string; value: string }
  | { type: "add-habilidade"; hit: CurriculumHit }
  | { type: "remove-habilidade"; codigo: string }
  | { type: "limpar-habilidades" }
  | { type: "set-buscando"; value: boolean }
  | { type: "set-resultados-busca"; hits: CurriculumHit[] }
  | { type: "limpar-resultados-busca" }
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
    resultadosBusca: [],
    buscaJaExecutada: false,
    aulas: [{ data: hoje }],
    metodologia: "",
    recursos: "",
    observacoes_turma: "",
    extras: {},
  };
}

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "set-extra":
      return {
        ...state,
        extras: { ...state.extras, [action.key]: action.value },
      };
    case "add-habilidade": {
      if (state.habilidadesSelecionadas.some((h) => h.codigo === action.hit.codigo))
        return state;
      return {
        ...state,
        habilidadesSelecionadas: [...state.habilidadesSelecionadas, action.hit],
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
    case "set-resultados-busca":
      return {
        ...state,
        resultadosBusca: action.hits,
        buscaJaExecutada: true,
      };
    case "limpar-resultados-busca":
      return { ...state, resultadosBusca: [], buscaJaExecutada: false };
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
  auth?: import("../lib/userAuth").AuthState | null;
  onVoltar: () => void;
  onPrecisaLogin?: () => void;
}

export function WizardScreen({ modo, auth, onVoltar, onPrecisaLogin }: Props) {
  const modoInfo = MODO_BY_ID[modo];

  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
  // config efetiva muda conforme alguns extras (ex.: recomp atividades vs aula)
  const config = useMemo(
    () => getEffectiveWizardConfig(modo, state.extras),
    [modo, state.extras],
  );
  // referencia estavel ao base config para validacoes nao dependentes de extras
  // (mantida apenas pra eslint)
  void WIZARD_CONFIG_POR_MODO;
  const [resultado, setResultado] = useState<GenerateResponse | null>(null);
  const [requestUsado, setRequestUsado] = useState<GenerateRequest | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const seriesDisponiveis = useMemo(
    () => (state.etapa ? SERIES_POR_ETAPA[state.etapa] || [] : []),
    [state.etapa],
  );

  const disciplinasDisponiveis = useMemo(
    () => disciplinasParaEtapa(state.etapa),
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

  // Validacao: campos extras obrigatorios precisam estar preenchidos
  const extrasObrigatoriosOk = config.camposExtras
    .filter((c) => "obrigatorio" in c && c.obrigatorio)
    .every((c) => {
      const v = state.extras[c.key];
      return v !== undefined && String(v).trim().length > 0;
    });

  const aulasDataOk =
    !config.precisaAulasComData ||
    config.aulasModo === "quantidade" ||
    state.aulas.every((a) => a.data);

  const podeGerar =
    !!state.etapa &&
    !!state.disciplina &&
    state.tema.trim().length >= 2 &&
    state.aulas.length >= 1 &&
    aulasDataOk &&
    extrasObrigatoriosOk;

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
        top_k: 5,
      });
      dispatch({ type: "set-resultados-busca", hits: r.hits });
      if (r.hits.length === 0) {
        setErro(
          "Nenhuma habilidade encontrada. Tente outro termo ou remova os filtros.",
        );
      }
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao buscar habilidade.");
    } finally {
      dispatch({ type: "set-buscando", value: false });
    }
  }

  async function gerar(opts?: { forceRegenerate?: boolean }) {
    setErro(null);
    setGerando(true);
    setResultado(null);

    // Aulas:
    // - "datas":      mandamos como o user preencheu
    // - "quantidade": forcamos data = hoje em todas
    // - sem aulas:    mandamos 1 aula com data de hoje (placeholder)
    const hoje = new Date().toISOString().slice(0, 10);
    const aulas = !config.precisaAulasComData
      ? [{ data: hoje }]
      : config.aulasModo === "quantidade"
      ? state.aulas.map((a) => ({ ...a, data: a.data || hoje }))
      : state.aulas;

    // converte extras (strings) pros campos esperados pelo backend
    const extras = state.extras;
    const numExtra = (key: string): number | undefined => {
      const v = extras[key];
      const n = v ? parseInt(v) : NaN;
      return Number.isFinite(n) ? n : undefined;
    };

    // No card de Planejamento de Aula, o toggle _brevidade decide qual
    // modo do backend usar (plano breve vs sugestao detalhada).
    const modoEfetivo: typeof modo =
      modo === "plano_de_aula" && state.extras._brevidade === "detalhado"
        ? "sugestao_de_aula"
        : modo;

    const req: GenerateRequest = {
      modo: modoEfetivo,
      etapa: state.etapa,
      serie: state.serie || undefined,
      disciplina: state.disciplina,
      tema: state.tema,
      foco_especifico: state.foco_especifico || undefined,
      codigos_bncc: state.habilidadesSelecionadas.map((h) => h.codigo),
      aulas,
      metodologia: state.metodologia || undefined,
      recursos: state.recursos || undefined,
      observacoes_turma: state.observacoes_turma || undefined,
      // recomp
      lacuna_aprendizagem: extras.lacuna_aprendizagem || undefined,
      nivel_defasagem: extras.nivel_defasagem || undefined,
      tipo_recomposicao: extras.tipo_recomposicao || undefined,
      // adapt
      adaptacao_necessaria: extras.adaptacao_necessaria || undefined,
      tipo_necessidade: extras.tipo_necessidade || undefined,
      apoios_disponiveis: extras.apoios_disponiveis || undefined,
      // lista exerc
      quantidade_questoes: numExtra("quantidade_questoes"),
      dificuldade: extras.dificuldade || undefined,
      tipo_questoes: extras.tipo_questoes || undefined,
      // projetos
      duracao_projeto: extras.duracao_projeto || undefined,
      produto_final: extras.produto_final || undefined,
      publico_apresentacao: extras.publico_apresentacao || undefined,
      // bypass de cache se professor clicou Regerar
      force_regenerate: opts?.forceRegenerate || undefined,
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
          : "Falha ao gerar. Tente novamente em instantes.",
      );
    } finally {
      setGerando(false);
    }
  }

  function renderCampoExtra(c: typeof config.camposExtras[number]) {
    // Visibilidade condicional
    if (c.mostrarSe && !c.mostrarSe(state.extras)) return null;

    const v = state.extras[c.key] ?? "";
    const setV = (val: string) =>
      dispatch({ type: "set-extra", key: c.key, value: val });
    const labelComObrig =
      "obrigatorio" in c && c.obrigatorio ? `${c.label} *` : c.label;

    switch (c.tipo) {
      case "input":
        return (
          <Input
            key={c.key}
            label={labelComObrig}
            hint={c.hint}
            placeholder={c.placeholder}
            value={v}
            onChange={(e) => setV(e.target.value)}
          />
        );
      case "textarea":
        return (
          <Textarea
            key={c.key}
            label={labelComObrig}
            hint={c.hint}
            placeholder={c.placeholder}
            rows={c.rows}
            value={v}
            onChange={(e) => setV(e.target.value)}
          />
        );
      case "select":
        return (
          <Select
            key={c.key}
            label={labelComObrig}
            hint={c.hint}
            value={v}
            placeholder="Selecione..."
            options={c.options}
            onChange={(e) => setV(e.target.value)}
          />
        );
      case "number": {
        const valor = v !== "" ? v : String(c.defaultValue ?? "");
        return (
          <Input
            key={c.key}
            label={labelComObrig}
            hint={c.hint}
            type="number"
            min={c.min}
            max={c.max}
            value={valor}
            onChange={(e) => setV(e.target.value)}
          />
        );
      }
      case "radio": {
        const valor = v !== "" ? v : c.defaultValue ?? "";
        return (
          <RadioGroup
            key={c.key}
            label={labelComObrig}
            hint={c.hint}
            value={valor}
            onChange={setV}
            options={c.options}
            name={c.key}
          />
        );
      }
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onVoltar}
            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <modoInfo.icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
              {modoInfo.titulo}
            </h1>
            <p className="text-sm text-neutral-500">
              {modoInfo.descricao}
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
                // tambem zera disciplina porque pode nao bater com a nova etapa
                dispatch({ type: "set", field: "disciplina", value: "" });
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
              label={
                state.etapa === "Educacao Infantil"
                  ? "Campo de experiência"
                  : state.etapa === "Ensino Medio"
                  ? "Área do conhecimento"
                  : "Componente curricular"
              }
              value={state.disciplina}
              placeholder={
                state.etapa
                  ? "Selecione..."
                  : "Escolha a etapa antes"
              }
              disabled={!state.etapa}
              onChange={(e) =>
                dispatch({ type: "set", field: "disciplina", value: e.target.value })
              }
              options={disciplinasDisponiveis.map((d) => ({ value: d, label: d }))}
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
            subtitulo="busque por código ou tema; pode adicionar várias"
          >
            <div className="flex items-end gap-2">
              <Input
                label="Código ou termo"
                hint="Ex: EM13CHS502  —  ou um termo: globalização, fração, leitura"
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
                Buscar
              </Button>
            </div>

            {/* Resultados da ultima busca */}
            {state.buscaJaExecutada && state.resultadosBusca.length > 0 && (
              <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-neutral-600">
                    {state.resultadosBusca.length} resultado
                    {state.resultadosBusca.length > 1 ? "s" : ""} — clique em "Adicionar" para usar
                  </p>
                  <button
                    onClick={() => dispatch({ type: "limpar-resultados-busca" })}
                    className="text-xs text-neutral-500 hover:text-neutral-800"
                  >
                    Ocultar
                  </button>
                </div>
                <div className="space-y-1.5">
                  {state.resultadosBusca.map((hit) => {
                    const jaAdicionada = state.habilidadesSelecionadas.some(
                      (h) => h.codigo === hit.codigo,
                    );
                    return (
                      <div
                        key={hit.codigo}
                        className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-brand-700">
                              {hit.codigo}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {hit.disciplina} • {hit.serie || hit.etapa}
                            </span>
                            {hit.similarity >= 0.99 ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                exato
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-400">
                                relevância {(hit.similarity * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-700">
                            {hit.habilidades || hit.texto}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={jaAdicionada ? "ghost" : "secondary"}
                          disabled={jaAdicionada}
                          onClick={() =>
                            dispatch({ type: "add-habilidade", hit })
                          }
                        >
                          {jaAdicionada ? "Adicionada" : "Adicionar"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Habilidades ja escolhidas */}
            {state.habilidadesSelecionadas.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Selecionadas ({state.habilidadesSelecionadas.length})
                </p>
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

          {/* 4. Detalhes do material — sempre que houver camposExtras */}
          {config.camposExtras.length > 0 && (
            <StepBlock
              numero={4}
              titulo={
                config.precisaAulasComData
                  ? "Detalhes do material"
                  : config.rotuloAulasSection
              }
              subtitulo={
                config.precisaAulasComData
                  ? "campos específicos deste modo"
                  : config.subtituloAulas
              }
            >
              {config.camposExtras.map((c) => renderCampoExtra(c))}
            </StepBlock>
          )}

          {/* 5. Aulas (datas ou quantidade) — quando aplicavel */}
          {config.precisaAulasComData && (config.aulasModo ?? "datas") === "datas" && (
            <StepBlock
              numero={config.camposExtras.length > 0 ? 5 : 4}
              titulo={config.rotuloAulasSection}
              subtitulo={`${config.subtituloAulas} (${state.aulas.length}/5)`}
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
                  + Adicionar {config.rotuloAulasSection.toLowerCase().includes("etapa") ? "etapa" : "aula"}
                </Button>
              )}
            </StepBlock>
          )}

          {config.precisaAulasComData && config.aulasModo === "quantidade" && (
            <StepBlock
              numero={config.camposExtras.length > 0 ? 5 : 4}
              titulo={config.rotuloAulasSection}
              subtitulo={config.subtituloAulas}
            >
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        const hoje = new Date().toISOString().slice(0, 10);
                        // troca o array de aulas pra ter exatamente N entradas
                        const atual = state.aulas.length;
                        if (n > atual) {
                          for (let i = atual; i < n; i++) {
                            dispatch({ type: "add-aula" });
                          }
                        } else if (n < atual) {
                          for (let i = atual; i > n; i--) {
                            dispatch({ type: "remove-aula", index: i - 1 });
                          }
                        }
                        // garante data padrao em todas
                        state.aulas.forEach((a, i) => {
                          if (!a.data && i < n) {
                            dispatch({
                              type: "set-aula",
                              index: i,
                              aula: { ...a, data: hoje },
                            });
                          }
                        });
                      }}
                      className={
                        "h-10 w-10 rounded-lg border text-sm font-medium transition-colors " +
                        (state.aulas.length === n
                          ? "border-brand-500 bg-brand-50 text-brand-800"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300")
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="pb-2 text-xs text-neutral-500">
                  {state.aulas.length} aula
                  {state.aulas.length > 1 ? "s" : ""} selecionada
                  {state.aulas.length > 1 ? "s" : ""}
                </p>
              </div>
            </StepBlock>
          )}

          {/* Preferencias gerais (se houver algum campo a mostrar) */}
          {(config.mostrarMetodologia ||
            config.mostrarRecursos ||
            config.mostrarObservacoesTurma) && (
            <StepBlock
              numero={
                3 +
                (config.camposExtras.length > 0 ? 1 : 0) +
                (config.precisaAulasComData ? 1 : 0)
              }
              titulo="Preferências gerais"
              subtitulo="opcional, mas melhora a qualidade"
            >
              {config.mostrarMetodologia && (
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
              )}
              {config.mostrarRecursos && (
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
              )}
              {config.mostrarObservacoesTurma && (
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
              )}
            </StepBlock>
          )}

          {/* Botoes sticky */}
          <div className="sticky bottom-4 flex gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-card">
            <Button
              variant="ghost"
              onClick={() => {
                dispatch({ type: "limpar" });
                setResultado(null);
                setRequestUsado(null);
                setErro(null);
              }}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              Limpar
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => gerar()}
              loading={gerando}
              disabled={!podeGerar}
              className="flex-1"
            >
              {gerando ? "Gerando..." : config.tituloAcao}
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

        {/* COLUNA DIREITA — RESULTADO (sticky no desktop) */}
        <div className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <ResultPane
            modo={modo}
            resultado={resultado}
            requestUsado={requestUsado}
            gerando={gerando}
            auth={auth}
            onRegerar={resultado ? () => gerar({ forceRegenerate: true }) : undefined}
            onPrecisaLogin={onPrecisaLogin}
          />
        </div>
      </div>
    </div>
  );
}
