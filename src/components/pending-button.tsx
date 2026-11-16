"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/** Botón de envío para acciones largas: se desactiva, muestra una barra animada y los segundos transcurridos. */
export function PendingButton({
  children,
  pendingText,
  hint,
  disabled,
  title,
  className = "",
}: {
  children: React.ReactNode;
  pendingText: string;
  hint?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!pending) return;
    const start = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 500);
    return () => {
      clearInterval(id);
      setSeconds(0);
    };
  }, [pending]);

  return (
    <div>
      <button type="submit" disabled={disabled || pending} title={title} aria-busy={pending} className={className + " disabled:opacity-60"}>
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            {pendingText}
          </span>
        ) : (
          children
        )}
      </button>
      {pending && (
        <div role="status" aria-live="polite" className="mt-3 w-full max-w-md">
          <div className="h-2 overflow-hidden rounded-full bg-brand-100">
            <div className="h-full w-1/3 animate-[pending-slide_1.4s_ease-in-out_infinite] rounded-full bg-brand-600" />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {pendingText} {seconds} s{hint ? ` · ${hint}` : ""}
          </p>
          <p className="text-xs text-slate-500">No cierres ni recargues esta página.</p>
        </div>
      )}
    </div>
  );
}
