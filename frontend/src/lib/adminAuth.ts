/**
 * Armazenamento e validacao das credenciais do painel admin.
 * Guardadas em localStorage do navegador (so vale pra esse browser).
 */

const KEY = "espaco-docente:admin-auth:v1";

export interface AdminCreds {
  user: string;
  password: string;
}

export function loadCreds(): AdminCreds | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminCreds;
  } catch {
    return null;
  }
}

export function saveCreds(c: AdminCreds): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // ignora silenciosamente
  }
}

export function clearCreds(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}

export function adminHeaders(c: AdminCreds | null): Record<string, string> {
  if (!c) return {};
  return {
    "X-Admin-User": c.user,
    "X-Admin-Password": c.password,
  };
}
