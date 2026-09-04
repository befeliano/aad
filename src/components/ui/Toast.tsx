"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  msg: string;
  kind: ToastKind;
}

const ToastCtx = createContext<{
  toast: (msg: string, kind?: ToastKind) => void;
}>({ toast: () => {} });

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((msg: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setItems((v) => [...v, { id, msg, kind }]);
    setTimeout(() => {
      setItems((v) => v.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismiss = (id: number) =>
    setItems((v) => v.filter((t) => t.id !== id));

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(370px,calc(100vw-2.5rem))] flex-col gap-2">
        {items.map((t) => {
          const Icon =
            t.kind === "success"
              ? CheckCircle2
              : t.kind === "error"
                ? AlertCircle
                : Info;
          const color =
            t.kind === "success"
              ? "text-ok"
              : t.kind === "error"
                ? "text-bad"
                : "text-info";
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-bg-1 p-3.5 shadow-[var(--shadow)]"
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} />
              <span className="flex-1 text-sm leading-snug text-ink">
                {t.msg}
              </span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                aria-label="Kapat"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
