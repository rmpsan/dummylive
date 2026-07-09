"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

type Tipo = "info" | "erro" | "sucesso";
interface Toast {
  id: number;
  texto: string;
  tipo: Tipo;
}

interface ToastCtx {
  show: (texto: string, tipo?: Tipo) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

/** Hook de toasts. Fora do provider, vira no-op seguro. */
export function useToast(): ToastCtx {
  return useContext(Ctx) ?? { show: () => {} };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const show = useCallback((texto: string, tipo: Tipo = "info") => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, texto, tipo }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      3800
    );
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 safe-bottom"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`dl-toast pointer-events-auto max-w-sm ${
              t.tipo === "erro"
                ? "dl-toast-erro"
                : t.tipo === "sucesso"
                  ? "dl-toast-sucesso"
                  : ""
            }`}
          >
            <span aria-hidden>
              {t.tipo === "erro" ? "⚠️" : t.tipo === "sucesso" ? "✓" : "•"}
            </span>
            <span>{t.texto}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
