/**
 * Estado de autenticacao do professor (login simples user+senha).
 * Token JWT armazenado em localStorage.
 */

const KEY = "espaco-docente:user-auth:v1";

export interface ProfessorUser {
  id: number;
  username: string;
  nome_exibicao?: string | null;
  ativo?: boolean;
}

export interface AuthState {
  token: string;
  user: ProfessorUser;
}

export function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function saveAuth(a: AuthState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    // ignora
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}

export function authHeader(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
