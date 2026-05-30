import type { GenerateRequest, GenerateResponse, PlanoSalvo } from "./types";

const KEY = "espaco-docente:historico:v1";

function load(): PlanoSalvo[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PlanoSalvo[];
  } catch {
    return [];
  }
}

function save(list: PlanoSalvo[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // localStorage cheio ou bloqueado; ignora silenciosamente
  }
}

export const historico = {
  listar: load,

  adicionar(req: GenerateRequest, res: GenerateResponse): PlanoSalvo {
    const list = load();
    const item: PlanoSalvo = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      request: req,
      response: res,
    };
    list.unshift(item);
    // limita histórico a 50 últimos pra não estourar localStorage
    save(list.slice(0, 50));
    return item;
  },

  remover(id: string): void {
    save(load().filter((p) => p.id !== id));
  },

  limpar(): void {
    save([]);
  },
};
