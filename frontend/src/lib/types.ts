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
  codigo_bncc?: string;
  aulas: AulaInput[];
  metodologia?: string;
  recursos?: string;
  observacoes_turma?: string;
  adaptacao_necessaria?: string;
  lacuna_aprendizagem?: string;
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
