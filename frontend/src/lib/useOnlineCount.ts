/**
 * Hook que mantem o contador de pessoas online em tempo real.
 *
 * Gera um session_id estavel por aba (sobrevive ao reload via sessionStorage)
 * e faz ping no backend a cada 15s. O backend devolve quantas sessoes estao
 * ativas; o hook expoe esse numero.
 *
 * Se o ping falhar (offline, backend dormindo), retorna o ultimo valor conhecido
 * — sem flicker pra zero. Retorna null ate o 1o ping bem-sucedido.
 */
import { useEffect, useState } from "react";

import { api } from "./api";

const INTERVALO_MS = 15_000;
const STORAGE_KEY = "ed_session_id";

function obterSessionId(): string {
  try {
    const existente = sessionStorage.getItem(STORAGE_KEY);
    if (existente) return existente;
    const novo = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, novo);
    return novo;
  } catch {
    // SSR ou storage bloqueado: gera um id volatil
    return crypto.randomUUID();
  }
}

export function useOnlineCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const sessionId = obterSessionId();
    let cancelado = false;

    async function ping() {
      try {
        const r = await api.presencePing(sessionId);
        if (!cancelado) setCount(r.online);
      } catch {
        // mantem ultimo valor conhecido
      }
    }

    ping();
    const id = window.setInterval(ping, INTERVALO_MS);

    // Quando a aba volta a ficar visivel, dispara um ping imediato
    // pra recuperar o contador rapido (em vez de esperar ate 15s).
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelado = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return count;
}
