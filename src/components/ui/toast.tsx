"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "good" | "danger" | "info";
type Toast = { id: number; title: string; description?: string; tone: ToastTone };

type ToastApi = {
  toast: (input: { title: string; description?: string; tone?: ToastTone }) => void;
};

const ToastContext = createContext<ToastApi | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((item) => item.id !== id)), []);

  const toast = useCallback<ToastApi["toast"]>(
    ({ title, description, tone = "info" }) => {
      const id = ++counter.current;
      setToasts((list) => [...list.slice(-3), { id, title, description, tone }]);
      window.setTimeout(() => dismiss(id), tone === "danger" ? 8000 : 4500);
    },
    [dismiss]
  );

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2">
        {toasts.map((item) => {
          const Icon = item.tone === "good" ? CheckCircle2 : item.tone === "danger" ? AlertTriangle : Info;
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-(--shadow-pop)",
                item.tone === "good" && "border-good-100",
                item.tone === "danger" && "border-brand-200",
                item.tone === "info" && "border-ink-200"
              )}
            >
              <Icon size={18} className={cn("mt-0.5 shrink-0", item.tone === "good" && "text-good-600", item.tone === "danger" && "text-brand-600", item.tone === "info" && "text-info-600")} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-ink-900">{item.title}</div>
                {item.description ? <div className="mt-0.5 text-[13px] leading-5 text-ink-500">{item.description}</div> : null}
              </div>
              <button onClick={() => dismiss(item.id)} className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900" aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
