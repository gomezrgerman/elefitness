"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { XIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon } from "lucide-react";

type ToastTipo = "success" | "error" | "info";

interface ToastItem {
  id: string;
  mensaje: string;
  tipo: ToastTipo;
  saliendo: boolean;
}

interface ToastContexto {
  toast: (mensaje: string, tipo?: ToastTipo) => void;
}

const ToastContext = createContext<ToastContexto | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

const ICONOS: Record<ToastTipo, typeof CheckCircleIcon> = {
  success: CheckCircleIcon,
  error: AlertCircleIcon,
  info: InfoIcon,
};

const ESTILOS: Record<ToastTipo, string> = {
  success: "border-emerald-800/60 bg-emerald-950/80 text-emerald-200",
  error: "border-red-800/60 bg-red-950/80 text-red-200",
  info: "border-primary/40 bg-card/95 text-foreground",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((mensaje: string, tipo: ToastTipo = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, mensaje, tipo, saliendo: false }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, saliendo: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 250);
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2" aria-live="polite">
        {toasts.map((t) => {
          const Icono = ICONOS[t.tipo];
          return (
            <div
              key={t.id}
              role={t.tipo === "error" ? "alert" : "status"}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm",
                ESTILOS[t.tipo],
                t.saliendo
                  ? "animate-[toast-out_0.25s_ease-in_forwards]"
                  : "animate-[toast-in_0.35s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
              )}
            >
              <Icono className="size-4 shrink-0" />
              <span>{t.mensaje}</span>
              <button
                onClick={() => {
                  setToasts((prev) => prev.map((x) => (x.id === t.id ? { ...x, saliendo: true } : x)));
                  setTimeout(() => {
                    setToasts((prev) => prev.filter((x) => x.id !== t.id));
                  }, 250);
                }}
                className="ml-2 shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
