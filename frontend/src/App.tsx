import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HomeScreen } from "./screens/HomeScreen";
import { WizardScreen } from "./screens/WizardScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { QuestoesScreen } from "./screens/QuestoesScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { LoginUserScreen } from "./screens/LoginUserScreen";
import { PerfilScreen } from "./screens/PerfilScreen";
import { UsageMeter } from "./components/UsageMeter";
import { loadAuth } from "./lib/userAuth";
import type { AuthState } from "./lib/userAuth";
import type { Modo } from "./lib/types";

type View =
  | { kind: "home" }
  | { kind: "wizard"; modo: Modo }
  | { kind: "history" }
  | { kind: "questoes" }
  | { kind: "admin" }
  | { kind: "login-user" }
  | { kind: "perfil" };

export default function App() {
  const [view, setView] = useState<View>({ kind: "home" });
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth());

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AnimatePresence mode="wait">
        <motion.div
          key={JSON.stringify(view)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {view.kind === "home" && (
            <HomeScreen
              auth={auth}
              onEscolher={(modo) => setView({ kind: "wizard", modo })}
              onAbrirHistorico={() => setView({ kind: "history" })}
              onAbrirBancoQuestoes={() => setView({ kind: "questoes" })}
              onAbrirAdmin={() => setView({ kind: "admin" })}
              onAbrirLogin={() => setView({ kind: "login-user" })}
              onAbrirPerfil={() => setView({ kind: "perfil" })}
            />
          )}
          {view.kind === "wizard" && (
            <WizardScreen
              modo={view.modo}
              auth={auth}
              onVoltar={() => setView({ kind: "home" })}
              onPrecisaLogin={() => setView({ kind: "login-user" })}
            />
          )}
          {view.kind === "history" && (
            <HistoryScreen onVoltar={() => setView({ kind: "home" })} />
          )}
          {view.kind === "questoes" && (
            <QuestoesScreen onVoltar={() => setView({ kind: "home" })} />
          )}
          {view.kind === "admin" && (
            <AdminScreen onVoltar={() => setView({ kind: "home" })} />
          )}
          {view.kind === "login-user" && (
            <LoginUserScreen
              onVoltar={() => setView({ kind: "home" })}
              onSucesso={(a) => {
                setAuth(a);
                setView({ kind: "perfil" });
              }}
            />
          )}
          {view.kind === "perfil" && auth && (
            <PerfilScreen
              auth={auth}
              onLogout={() => {
                setAuth(null);
                setView({ kind: "home" });
              }}
              onVoltar={() => setView({ kind: "home" })}
            />
          )}
          {view.kind === "perfil" && !auth && (
            <LoginUserScreen
              onVoltar={() => setView({ kind: "home" })}
              onSucesso={(a) => {
                setAuth(a);
                setView({ kind: "perfil" });
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
      <UsageMeter />
    </div>
  );
}
