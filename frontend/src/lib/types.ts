// Espelham os schemas Pydantic do backend (app/schemas.py)

export type Modo =
  | "plano_de_aula"
  | "sugestao_de_aula"
  | "lista_de_exercicios"
  | "projetos_e_trabalhos"
  | "recomposicao_paralela"
  | "adaptacao_educacao_especial";

export interface CurriculumHit {
  codigo: string;
  fonte: string;
  etapa: string | null;
  serie: string | null;
  disciplina: string | null;
  habilidades: string | null;
  texto: string;
  similarity: number;
}

export interface SearchBNCCRequest {
  query: string;
  etapa?: string | null;
  disciplina?: string | null;
  top_k?: number;
}
export interface SearchBNCCResponse {
  hits: CurriculumHit[];
}

export interface AulaInput {
  data: string; // YYYY-MM-DD
  observacoes?: string;
}

export interface GenerateRequest {
  modo: Modo;
  etapa: string;
  serie?: string;
  disciplina: string;
  tema: string;
  foco_especifico?: string;
  codigos_bncc?: string[];
  codigo_bncc?: string; // legado (compat)
  aulas: AulaInput[];
  metodologia?: string;
  recursos?: string;
  observacoes_turma?: string;
  // Recomposição
  lacuna_aprendizagem?: string;
  nivel_defasagem?: string;
  tipo_recomposicao?: string; // 'aula' | 'atividades'
  // Adaptação
  adaptacao_necessaria?: string;
  tipo_necessidade?: string;
  apoios_disponiveis?: string;
  // Lista de exercícios
  quantidade_questoes?: number;
  dificuldade?: string;
  tipo_questoes?: string;
  // Projetos
  duracao_projeto?: string;
  produto_final?: string;
  publico_apresentacao?: string;
}

export interface AulaOutput {
  numero: number;
  codigo_bncc: string | null;
  data: string;
  texto: string;
  palavras: number;
}

export interface GenerateResponse {
  modo: Modo;
  tema: string;
  aulas: AulaOutput[];
  habilidades_usadas: CurriculumHit[];
  aviso: string;
}

// Histórico salvo no localStorage
export interface PlanoSalvo {
  id: string;
  createdAt: string;
  request: GenerateRequest;
  response: GenerateResponse;
}

// Banco de questões de vestibular
export interface Alternativa {
  letter: string;
  text: string;
}

export interface QuestaoHit {
  id: number;
  vestibular: string;
  ano: number;
  numero: number;
  disciplina: string | null;
  area_enem: string | null;
  idioma: string | null;
  contexto: string | null;
  enunciado: string;
  alternativas: Alternativa[];
  gabarito: string;
  imagens: string[];
  similarity: number;
}

export interface SearchQuestoesRequest {
  query: string;
  disciplina?: string | null;
  ano_min?: number | null;
  ano_max?: number | null;
  top_k?: number;
}

export interface SearchQuestoesResponse {
  hits: QuestaoHit[];
}
