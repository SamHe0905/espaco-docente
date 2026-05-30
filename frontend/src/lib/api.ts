import type {
  GenerateRequest,
  GenerateResponse,
  SearchBNCCRequest,
  SearchBNCCResponse,
  SearchQuestoesRequest,
  SearchQuestoesResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function post<TIn, TOut>(path: string, body: TIn): Promise<TOut> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let detail = r.statusText;
    try {
      const j = await r.json();
      detail = j.detail || detail;
    } catch {
      // ignore
    }
    throw new ApiError(r.status, detail);
  }
  return (await r.json()) as TOut;
}

export const api = {
  searchBNCC: (req: SearchBNCCRequest) =>
    post<SearchBNCCRequest, SearchBNCCResponse>("/search-bncc", req),

  generate: (req: GenerateRequest) =>
    post<GenerateRequest, GenerateResponse>("/generate", req),

  searchQuestoes: (req: SearchQuestoesRequest) =>
    post<SearchQuestoesRequest, SearchQuestoesResponse>("/search-questoes", req),
};

export { ApiError };
