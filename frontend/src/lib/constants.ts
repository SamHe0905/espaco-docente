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

export const DISCIPLINAS = [
  // Fundamental
  "Arte",
  "Ciencias",
  "Educacao Fisica",
  "Ensino Religioso",
  "Geografia",
  "Historia",
  "Lingua Inglesa",
  "Lingua Portuguesa",
  "Matematica",
  // Médio (áreas)
  "Ciencias Humanas e Sociais Aplicadas",
  "Ciencias da Natureza e suas Tecnologias",
  "Linguagens e suas Tecnologias",
  "Matematica e suas Tecnologias",
] as const;

export interface ModoInfo {
  id: Modo;
  titulo: string;
  descricao: string;
  icone: string; // emoji simples; pode trocar por SVG depois
  ordem: number;
  // campos extras que esse modo precisa
  precisa?: ("lacuna" | "adaptacao")[];
}

export const MODOS: ModoInfo[] = [
  {
    id: "plano_de_aula",
    titulo: "Plano de Aula",
    descricao: "Texto breve para registro no sistema",
    icone: "📋",
    ordem: 1,
  },
  {
    id: "sugestao_de_aula",
    titulo: "Sugestão de Aula",
    descricao: "Roteiro detalhado com metodologia",
    icone: "💡",
    ordem: 2,
  },
  {
    id: "lista_de_exercicios",
    titulo: "Lista de Exercícios",
    descricao: "Questões por nível com gabarito",
    icone: "✏️",
    ordem: 3,
  },
  {
    id: "projetos_e_trabalhos",
    titulo: "Projetos e Trabalhos",
    descricao: "Aprendizagem baseada em projetos",
    icone: "🎯",
    ordem: 4,
  },
  {
    id: "recomposicao_paralela",
    titulo: "Recomposição Paralela",
    descricao: "Exercícios focados na lacuna do aluno",
    icone: "🔄",
    ordem: 5,
    precisa: ["lacuna"],
  },
  {
    id: "adaptacao_educacao_especial",
    titulo: "Adaptação Ed. Especial",
    descricao: "Material adaptado conforme a necessidade",
    icone: "🤝",
    ordem: 6,
    precisa: ["adaptacao"],
  },
];

export const MODO_BY_ID = Object.fromEntries(
  MODOS.map((m) => [m.id, m]),
) as Record<Modo, ModoInfo>;
