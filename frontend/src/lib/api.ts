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

async function request<TOut>(
  path: string,
  init: RequestInit & { auth?: string | null } = {},
): Promise<TOut> {
  const { auth, headers, ...rest } = init;
  const r = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(headers as Record<string, string> | undefined),
    },
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
  if (r.status === 204) return undefined as unknown as TOut;
  return (await r.json()) as TOut;
}

async function post<TIn, TOut>(
  path: string, body: TIn, auth?: string | null,
): Promise<TOut> {
  return request<TOut>(path, { method: "POST", body: JSON.stringify(body), auth });
}

async function get<TOut>(path: string, auth?: string | null): Promise<TOut> {
  return request<TOut>(path, { method: "GET", auth });
}

async function del<TOut>(path: string, auth?: string | null): Promise<TOut> {
  return request<TOut>(path, { method: "DELETE", auth });
}

// Tipos locais pra evitar import circular
interface ProfessorUser { id: number; username: string; nome_exibicao?: string | null; ativo?: boolean; }
interface TokenResponse { token: string; user: ProfessorUser; }

export const api = {
  searchBNCC: (req: SearchBNCCRequest) =>
    post<SearchBNCCRequest, SearchBNCCResponse>("/search-bncc", req),

  generate: (req: GenerateRequest) =>
    post<GenerateRequest, GenerateResponse>("/generate", req),

  searchQuestoes: (req: SearchQuestoesRequest) =>
    post<SearchQuestoesRequest, SearchQuestoesResponse>("/search-questoes", req),

  // Presenca (contador de online em tempo real)
  presencePing: (sessionId: string) =>
    post<{ session_id: string }, { online: number }>("/presence/ping", {
      session_id: sessionId,
    }),

  // Auth
  register: (req: { username: string; password: string; nome_exibicao?: string }) =>
    post<typeof req, TokenResponse>("/auth/register", req),
  login: (req: { username: string; password: string }) =>
    post<typeof req, TokenResponse>("/auth/login", req),

  // Perfil
  me: (token: string) => get<ProfessorUser>("/me", token),
  meusPlanos: (token: string) =>
    get<import("./types").PlanoSalvoServer[]>("/me/planos", token),
  salvarPlano: (token: string, body: { modo: string; tema: string | null; request_json: GenerateRequest; response_json: GenerateResponse }) =>
    post<typeof body, import("./types").PlanoSalvoServer>("/me/planos", body, token),
  excluirPlano: (token: string, id: number) =>
    del<{ ok: boolean }>(`/me/planos/${id}`, token),
};

export { ApiError };
