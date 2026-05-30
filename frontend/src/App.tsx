import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HomeScreen } from "./screens/HomeScreen";
import { WizardScreen } from "./screens/WizardScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { QuestoesScreen } from "./screens/QuestoesScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { UsageMeter } from "./components/UsageMeter";
import type { Modo } from "./lib/types";

type View =
  | { kind: "home" }
  | { kind: "wizard"; modo: Modo }
  | { kind: "history" }
  | { kind: "questoes" }
  | { kind: "admin" };

export default function App() {
  const [view, setView] = useState<View>({ kind: "home" });

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
              onEscolher={(modo) => setView({ kind: "wizard", modo })}
              onAbrirHistorico={() => setView({ kind: "history" })}
              onAbrirBancoQuestoes={() => setView({ kind: "questoes" })}
              onAbrirAdmin={() => setView({ kind: "admin" })}
            />
          )}
          {view.kind === "wizard" && (
            <WizardScreen
              modo={view.modo}
              onVoltar={() => setView({ kind: "home" })}
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
        </motion.div>
      </AnimatePresence>
      <UsageMeter />
    </div>
  );
}
