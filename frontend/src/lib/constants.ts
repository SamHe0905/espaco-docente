import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Compass,
  HeartHandshake,
  Library,
  NotebookPen,
  RefreshCw,
} from "lucide-react";

import type { Modo } from "./types";

export const ETAPAS = [
  "Educacao Infantil",
  "Ensino Fundamental",
  "Ensino Medio",
] as const;

export const SERIES_POR_ETAPA: Record<string, string[]> = {
  "Educacao Infantil": [
    "Bebês (0 a 1 ano e 6 meses)",
    "Crianças bem pequenas (1 ano e 7 meses a 3 anos e 11 meses)",
    "Crianças pequenas (4 anos a 5 anos e 11 meses)",
  ],
  "Ensino Fundamental": [
    "1º ano",
    "2º ano",
    "3º ano",
    "4º ano",
    "5º ano",
    "6º ano",
    "7º ano",
    "8º ano",
    "9º ano",
  ],
  "Ensino Medio": ["1º ano", "2º ano", "3º ano"],
};

// Exemplos curriculares por disciplina, mostrados como hint no campo Tema.
// Sempre 3 por disciplina, escolhidos pra serem familiares aos professores
// brasileiros e cobrirem etapas/anos diferentes.
export const EXEMPLOS_TEMA_POR_DISCIPLINA: Record<string, string[]> = {
  "Arte": ["dança brasileira", "música popular", "artes visuais contemporâneas"],
  "Ciencias": ["célula e organelos", "ecossistemas", "sistema solar"],
  "Educacao Fisica": [
    "brincadeiras tradicionais",
    "esportes coletivos",
    "ginástica e ritmo",
  ],
  "Ensino Religioso": [
    "diversidade religiosa no Brasil",
    "valores éticos universais",
    "ritos e símbolos",
  ],
  "Geografia": ["globalização", "urbanização brasileira", "agronegócio e meio ambiente"],
  "Historia": [
    "revolução industrial",
    "ditadura militar no Brasil",
    "idade média europeia",
  ],
  "Lingua Inglesa": [
    "vocabulary: daily routine",
    "present perfect tense",
    "reading comprehension",
  ],
  "Lingua Portuguesa": [
    "interpretação de texto",
    "gêneros textuais",
    "narrativa e ponto de vista",
  ],
  "Matematica": [
    "equações do segundo grau",
    "frações e razões",
    "geometria plana",
  ],
  "Ciencias Humanas e Sociais Aplicadas": [
    "globalização e desigualdades",
    "cidadania e direitos humanos",
    "industrialização e mundo do trabalho",
  ],
  "Ciencias da Natureza e suas Tecnologias": [
    "genética e biotecnologia",
    "química do cotidiano",
    "energia e sustentabilidade",
  ],
  "Linguagens e suas Tecnologias": [
    "gêneros digitais",
    "literatura brasileira contemporânea",
    "argumentação e mídia",
  ],
  "Matematica e suas Tecnologias": [
    "funções",
    "estatística e probabilidade",
    "geometria analítica",
  ],
};

// fallback quando ainda nao escolheu disciplina
export const EXEMPLOS_TEMA_GENERICOS = [
  "globalização",
  "interpretação de texto",
  "ecossistemas",
];

// Componentes curriculares do Ensino Fundamental
export const DISCIPLINAS_FUNDAMENTAL = [
  "Arte",
  "Ciencias",
  "Educacao Fisica",
  "Ensino Religioso",
  "Geografia",
  "Historia",
  "Lingua Inglesa",
  "Lingua Portuguesa",
  "Matematica",
] as const;

// Areas do Ensino Medio (NEM)
export const DISCIPLINAS_MEDIO = [
  "Ciencias Humanas e Sociais Aplicadas",
  "Ciencias da Natureza e suas Tecnologias",
  "Linguagens e suas Tecnologias",
  "Matematica e suas Tecnologias",
  "Lingua Portuguesa",
] as const;

// Campos de experiencia da Educacao Infantil (BNCC)
export const DISCIPLINAS_INFANTIL = [
  "O eu, o outro e o nos",
  "Corpo, gestos e movimentos",
  "Tracos, sons, cores e formas",
  "Escuta, fala, pensamento e imaginacao",
  "Espacos, tempos, quantidades, relacoes e transformacoes",
] as const;

// Retorna o array adequado pra etapa selecionada
export function disciplinasParaEtapa(etapa: string): readonly string[] {
  switch (etapa) {
    case "Educacao Infantil":
      return DISCIPLINAS_INFANTIL;
    case "Ensino Medio":
      return DISCIPLINAS_MEDIO;
    case "Ensino Fundamental":
      return DISCIPLINAS_FUNDAMENTAL;
    default:
      // Sem etapa escolhida: lista combinada (fallback)
      return [
        ...DISCIPLINAS_FUNDAMENTAL,
        ...DISCIPLINAS_MEDIO.filter(
          (d) => !DISCIPLINAS_FUNDAMENTAL.includes(d as never),
        ),
      ];
  }
}

// Mantido pra compatibilidade
export const DISCIPLINAS = [
  ...DISCIPLINAS_FUNDAMENTAL,
  ...DISCIPLINAS_MEDIO.filter(
    (d) => !DISCIPLINAS_FUNDAMENTAL.includes(d as never),
  ),
] as const;

export interface ModoInfo {
  id: Modo;
  titulo: string;
  descricao: string;
  icon: LucideIcon;
  ordem: number;
  // campos extras que esse modo precisa
  precisa?: ("lacuna" | "adaptacao")[];
}

// Banco de Questoes nao e um modo de geracao, mas tem ficha aqui pra reuso
// de label/icon na home e em cabecalhos.
export const BANCO_QUESTOES_INFO = {
  titulo: "Banco de Questões",
  descricao:
    "Questões reais do ENEM (2009–2023). Busque, selecione e exporte como lista.",
  icon: Library,
};

export const MODOS: ModoInfo[] = [
  {
    id: "plano_de_aula",
    titulo: "Planejamento de Aula",
    descricao:
      "Texto breve para registro ou roteiro detalhado para a aula. Escolha a profundidade ao gerar.",
    icon: NotebookPen,
    ordem: 1,
  },
  {
    id: "lista_de_exercicios",
    titulo: "Lista de Exercícios",
    descricao:
      "Questões inéditas geradas por IA, com gabarito e níveis configuráveis.",
    icon: ClipboardList,
    ordem: 2,
  },
  {
    id: "projetos_e_trabalhos",
    titulo: "Projetos e Trabalhos",
    descricao:
      "Aprendizagem baseada em projetos, organizada por etapas e produto final.",
    icon: Compass,
    ordem: 3,
  },
  {
    id: "recomposicao_paralela",
    titulo: "Recomposição Paralela",
    descricao:
      "Aulas ou atividades focadas em lacunas de aprendizagem identificadas.",
    icon: RefreshCw,
    ordem: 4,
    precisa: ["lacuna"],
  },
  {
    id: "adaptacao_educacao_especial",
    titulo: "Adaptação Especial",
    descricao:
      "Material adaptado para necessidades educacionais específicas, com apoios e ritmo próprios.",
    icon: HeartHandshake,
    ordem: 5,
    precisa: ["adaptacao"],
  },
  // sugestao_de_aula e tratado como subtipo do plano_de_aula no frontend,
  // mas permanece como modo distinto no backend. Mantido aqui pra fallback
  // quando o backend ou historico antigo referencia o id, mas oculto na home.
  {
    id: "sugestao_de_aula",
    titulo: "Sugestão de Aula",
    descricao: "Roteiro detalhado da aula com etapas e mediação.",
    icon: NotebookPen,
    ordem: 99,
  },
];

// modos exibidos na tela inicial (ordenados, sem o sugestao_de_aula oculto)
export const MODOS_VISIVEIS = MODOS.filter((m) => m.ordem < 90).sort(
  (a, b) => a.ordem - b.ordem,
);

export const MODO_BY_ID = Object.fromEntries(
  MODOS.map((m) => [m.id, m]),
) as Record<Modo, ModoInfo>;

// ----------------------------------------------------------------------
// Configuracao do wizard por modo
// Define titulo, comportamento de cada step, campos extras
// ----------------------------------------------------------------------
export interface WizardConfig {
  // Label/cta
  tituloAcao: string;             // "Gerar plano de aula" etc
  rotuloAulasSection: string;     // "Aulas" / "Etapas do projeto" / null para esconder
  subtituloAulas: string;
  precisaAulasComData: boolean;   // se false, gera 1 aula fake sem data
  // Modo de coleta das aulas: "datas" = um date picker por aula
  //                          "quantidade" = soh um numero (datas viram hoje)
  //                          "oculto"     = nao mostra nada (vide precisaAulasComData=false)
  aulasModo?: "datas" | "quantidade" | "oculto";
  // Step 5 — preferencias
  mostrarMetodologia: boolean;
  mostrarRecursos: boolean;
  mostrarObservacoesTurma: boolean;
  // Campos especificos
  camposExtras: CampoExtra[];
}

// Visibilidade condicional baseada em outros campos do form
export type MostrarSe = (extras: Record<string, string>) => boolean;

export type CampoExtra =
  | ({ tipo: "input"; key: string; label: string; hint?: string; placeholder?: string; obrigatorio?: boolean; mostrarSe?: MostrarSe })
  | ({ tipo: "textarea"; key: string; label: string; hint?: string; placeholder?: string; rows?: number; obrigatorio?: boolean; mostrarSe?: MostrarSe })
  | ({ tipo: "select"; key: string; label: string; hint?: string; options: { value: string; label: string }[]; obrigatorio?: boolean; mostrarSe?: MostrarSe })
  | ({ tipo: "number"; key: string; label: string; hint?: string; min?: number; max?: number; defaultValue?: number; mostrarSe?: MostrarSe })
  | ({ tipo: "radio"; key: string; label: string; hint?: string; options: { value: string; label: string; description?: string }[]; defaultValue?: string; mostrarSe?: MostrarSe });

/**
 * Retorna a config efetiva do wizard considerando seleções do usuário
 * (por exemplo: recomposição-atividades não pede aulas com data).
 */
export function getEffectiveWizardConfig(
  modo: Modo,
  extras: Record<string, string>,
): WizardConfig {
  const base = WIZARD_CONFIG_POR_MODO[modo];
  // Recomposição: se atividades, vira lista — sem datas, label "Lista de atividades"
  if (modo === "recomposicao_paralela" && extras.tipo_recomposicao === "atividades") {
    return {
      ...base,
      tituloAcao: "Gerar atividades",
      rotuloAulasSection: "Lista de atividades",
      subtituloAulas: "uma lista por geração",
      precisaAulasComData: false,
    };
  }
  return base;
}

export const WIZARD_CONFIG_POR_MODO: Record<Modo, WizardConfig> = {
  plano_de_aula: {
    tituloAcao: "Gerar planejamento",
    rotuloAulasSection: "Aulas",
    subtituloAulas: "até 5 aulas por vez",
    precisaAulasComData: true,
    mostrarMetodologia: true,
    mostrarRecursos: true,
    mostrarObservacoesTurma: true,
    camposExtras: [
      {
        tipo: "radio",
        key: "_brevidade",
        label: "Profundidade do planejamento",
        defaultValue: "breve",
        options: [
          {
            value: "breve",
            label: "Plano breve",
            description:
              "Um parágrafo por aula — ideal para registro rápido no sistema da escola",
          },
          {
            value: "detalhado",
            label: "Roteiro detalhado",
            description:
              "Abertura, desenvolvimento e fechamento por aula — para usar como guia em sala",
          },
        ],
      },
    ],
  },
  sugestao_de_aula: {
    tituloAcao: "Gerar sugestão de aula",
    rotuloAulasSection: "Aulas",
    subtituloAulas: "até 5 aulas por vez",
    precisaAulasComData: true,
    mostrarMetodologia: true,
    mostrarRecursos: true,
    mostrarObservacoesTurma: true,
    camposExtras: [],
  },
  lista_de_exercicios: {
    tituloAcao: "Gerar lista de exercícios",
    rotuloAulasSection: "Configurações da lista",
    subtituloAulas: "uma lista por geração",
    precisaAulasComData: false,
    mostrarMetodologia: false,
    mostrarRecursos: false,
    mostrarObservacoesTurma: true,
    camposExtras: [
      {
        tipo: "number",
        key: "quantidade_questoes",
        label: "Quantidade de questões",
        hint: "5 a 30 questões",
        min: 5,
        max: 30,
        defaultValue: 5,
      },
      {
        tipo: "select",
        key: "dificuldade",
        label: "Nível de dificuldade",
        options: [
          { value: "basico", label: "Básico" },
          { value: "intermediario", label: "Intermediário" },
          { value: "avancado", label: "Avançado" },
          { value: "misto", label: "Misto (recomendado)" },
        ],
      },
      {
        tipo: "select",
        key: "tipo_questoes",
        label: "Tipo de questões",
        options: [
          { value: "objetivas", label: "Apenas objetivas (múltipla escolha)" },
          { value: "discursivas", label: "Apenas discursivas" },
          { value: "mista", label: "Mistas (80% objetivas + 20% discursivas)" },
        ],
      },
    ],
  },
  projetos_e_trabalhos: {
    tituloAcao: "Gerar esqueleto do projeto",
    rotuloAulasSection: "Detalhes do projeto",
    subtituloAulas: "informações pra moldar o esqueleto",
    precisaAulasComData: false,
    mostrarMetodologia: false,
    mostrarRecursos: true,
    mostrarObservacoesTurma: true,
    camposExtras: [
      {
        tipo: "input",
        key: "duracao_projeto",
        label: "Duração estimada do projeto",
        hint: "Ex: 2 semanas, 1 mês, 1 bimestre",
        placeholder: "Ex: 4 semanas",
      },
      {
        tipo: "input",
        key: "produto_final",
        label: "Produto/entregável final",
        hint: "O que os estudantes vão produzir?",
        placeholder: "Ex: apresentação, banner, vídeo, podcast",
      },
      {
        tipo: "input",
        key: "publico_apresentacao",
        label: "Público da apresentação",
        hint: "Para quem o projeto será apresentado?",
        placeholder: "Ex: a turma, a escola, as famílias, a comunidade",
      },
    ],
  },
  recomposicao_paralela: {
    tituloAcao: "Gerar recomposição",
    rotuloAulasSection: "Aulas de recomposição",
    subtituloAulas: "quantas aulas focadas na lacuna?",
    precisaAulasComData: true,
    aulasModo: "quantidade",
    mostrarMetodologia: false,
    mostrarRecursos: true,
    mostrarObservacoesTurma: true,
    camposExtras: [
      {
        tipo: "radio",
        key: "tipo_recomposicao",
        label: "O que você quer gerar?",
        defaultValue: "aula",
        options: [
          {
            value: "aula",
            label: "Aulas de recomposição",
            description: "Roteiros de aulas para retomar conceitos com a turma toda ou em grupos",
          },
          {
            value: "atividades",
            label: "Lista de atividades",
            description: "Exercícios práticos para os estudantes resolverem (em casa, sala de apoio, dever extra)",
          },
        ],
      },
      {
        tipo: "textarea",
        key: "lacuna_aprendizagem",
        label: "Lacuna de aprendizagem identificada",
        hint: "Descreva concretamente o que a turma ainda não dominou",
        placeholder: "Ex: dificuldade em interpretar problemas com fração, troca b/p, leitura silabada…",
        rows: 3,
        obrigatorio: true,
      },
      {
        tipo: "select",
        key: "nivel_defasagem",
        label: "Nível da defasagem",
        options: [
          { value: "leve", label: "Leve — alguns conceitos isolados" },
          { value: "media", label: "Média — bloco curricular do ano anterior" },
          { value: "grave", label: "Grave — fundamentos de 2+ anos atrás" },
        ],
      },
      // Campos extras só aparecem se o professor escolheu 'atividades'
      {
        tipo: "number",
        key: "quantidade_questoes",
        label: "Quantidade de atividades",
        hint: "5 a 15 atividades práticas",
        min: 5,
        max: 15,
        defaultValue: 8,
        mostrarSe: (e) => e.tipo_recomposicao === "atividades",
      },
      {
        tipo: "select",
        key: "tipo_questoes",
        label: "Tipo de atividades",
        options: [
          { value: "objetivas", label: "Objetivas (múltipla escolha)" },
          { value: "discursivas", label: "Discursivas" },
          { value: "mista", label: "Mistas (objetivas + discursivas)" },
        ],
        mostrarSe: (e) => e.tipo_recomposicao === "atividades",
      },
    ],
  },
  adaptacao_educacao_especial: {
    tituloAcao: "Gerar adaptação",
    rotuloAulasSection: "Aulas adaptadas",
    subtituloAulas: "até 5 aulas com adaptação aplicada",
    precisaAulasComData: true,
    mostrarMetodologia: false,
    mostrarRecursos: true,
    mostrarObservacoesTurma: false,
    camposExtras: [
      {
        tipo: "select",
        key: "tipo_necessidade",
        label: "Necessidade educacional específica",
        options: [
          { value: "TEA", label: "Transtorno do Espectro Autista (TEA)" },
          { value: "TDAH", label: "TDAH" },
          { value: "Deficiencia Visual", label: "Deficiência visual" },
          { value: "Deficiencia Auditiva", label: "Deficiência auditiva / surdez" },
          { value: "Deficiencia Intelectual", label: "Deficiência intelectual" },
          { value: "Deficiencia Motora", label: "Deficiência motora" },
          { value: "Dislexia", label: "Dislexia / outros transtornos de aprendizagem" },
          { value: "Altas Habilidades", label: "Altas habilidades / superdotação" },
          { value: "Outras", label: "Outras (descrever abaixo)" },
        ],
        obrigatorio: true,
      },
      {
        tipo: "textarea",
        key: "adaptacao_necessaria",
        label: "Detalhes do(s) estudante(s) e da adaptação",
        hint: "Ex: estudante com TEA, sensibilidade auditiva, comunicação verbal limitada…",
        placeholder: "Descreva o contexto específico que vai orientar a adaptação",
        rows: 3,
        obrigatorio: true,
      },
      {
        tipo: "input",
        key: "apoios_disponiveis",
        label: "Apoios disponíveis (opcional)",
        hint: "Ex: professor de apoio, sala de recursos, intérprete de Libras",
        placeholder: "",
      },
    ],
  },
};
