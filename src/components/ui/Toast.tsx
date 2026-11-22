"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useLocale } from "next-intl";
import { ui } from "@/lib/localize";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    if (duration > 0) {
      const timer = setTimeout(() => removeToast(id), duration);
      timers.current.set(id, timer);
    }
  }, [removeToast]);

  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      currentTimers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

const typeStyles: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: "bg-accent-green", icon: "✓" },
  error: { bg: "bg-red-600", icon: "✕" },
  warning: { bg: "bg-yellow-500", icon: "⚠" },
  info: { bg: "bg-base-dark", icon: "ℹ" },
};

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  const locale = useLocale();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto ${typeStyles[toast.type].bg} text-white px-4 py-3 rounded-xl shadow-lg flex items-start gap-3 animate-fade-in`}
          role="alert"
        >
          <span className="text-lg font-bold flex-shrink-0">{typeStyles[toast.type].icon}</span>
          <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
          <button
            type="button"
            onClick={() => onRemove(toast.id)}
            className="flex-shrink-0 opacity-70 hover:opacity-100 text-lg leading-none"
            aria-label={ui(locale, { de: "Schließen", en: "Close", bar: "Zuamacha" })}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}