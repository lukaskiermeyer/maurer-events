"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type DialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  initialValue?: string;
  inputLabel?: string;
};

type DialogRequest = DialogOptions & {
  mode: "confirm" | "prompt";
  resolve: (value: boolean | string | null) => void;
};

interface DialogContextValue {
  confirm: (options: DialogOptions) => Promise<boolean>;
  prompt: (options: DialogOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState("");
  const requestRef = useRef<DialogRequest | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((result: boolean | string | null) => {
    const current = requestRef.current;
    requestRef.current = null;
    setRequest(null);
    current?.resolve(result);
  }, []);

  const open = useCallback((mode: "confirm" | "prompt", options: DialogOptions) => {
    return new Promise<boolean | string | null>(resolve => {
      // Ein offener Dialog wird als abgebrochen gewertet, bevor der neue öffnet.
      const previous = requestRef.current;
      if (previous) previous.resolve(previous.mode === "confirm" ? false : null);
      const next: DialogRequest = { ...options, mode, resolve };
      requestRef.current = next;
      setRequest(next);
      setValue(options.initialValue ?? "");
    });
  }, []);

  const confirm = useCallback((options: DialogOptions) => open("confirm", options) as Promise<boolean>, [open]);
  const prompt = useCallback((options: DialogOptions) => open("prompt", options) as Promise<string | null>, [open]);

  useEffect(() => {
    if (!request) return;
    const cancelValue = request.mode === "confirm" ? false : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(cancelValue);
    };
    window.addEventListener("keydown", onKey);
    const focusTimer = setTimeout(() => {
      if (request.mode === "prompt") inputRef.current?.focus();
      else cancelRef.current?.focus();
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(focusTimer);
    };
  }, [request, close]);

  const cancelValue = request?.mode === "confirm" ? false : null;

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {request && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-base-dark/80 backdrop-blur-sm"
          onClick={() => close(cancelValue)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="themed-dialog-title"
            onClick={event => event.stopPropagation()}
            className="w-full max-w-md bg-white border border-border-light rounded-2xl shadow-xl p-6 animate-dialog-in"
          >
            <h2 id="themed-dialog-title" className="font-display font-bold text-xl mb-2">{request.title || (request.mode === "prompt" ? "Eingabe" : "Bitte bestätigen")}</h2>
            <p className="text-sm text-base-dark/70 leading-relaxed whitespace-pre-line">{request.message}</p>
            {request.mode === "prompt" && (
              <label className="block mt-4 text-xs font-bold">
                {request.inputLabel || "Wert"}
                <input
                  ref={inputRef}
                  value={value}
                  onChange={event => setValue(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter") close(value);
                  }}
                  className="mt-1 w-full bg-canvas-light border border-border-light rounded-lg p-3 font-normal focus:outline-none focus:border-accent-green"
                />
              </label>
            )}
            <div className="flex flex-wrap gap-2 mt-5">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => close(cancelValue)}
                className="flex-1 min-h-11 px-4 rounded-xl border border-border-light font-bold hover:bg-canvas-light"
              >
                {request.cancelLabel || "Abbrechen"}
              </button>
              <button
                type="button"
                onClick={() => close(request.mode === "confirm" ? true : value)}
                className={`flex-1 min-h-11 px-4 rounded-xl font-bold text-white ${request.danger ? "bg-red-600 hover:bg-red-700" : "bg-accent-green hover:bg-accent-green/90"}`}
              >
                {request.confirmLabel || "Bestätigen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
