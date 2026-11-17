"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Botón de acción destructiva con confirmación en el mismo lugar (sin ventana emergente): al pulsarlo muestra la pregunta
 * y los botones «Sí, …» y «Cancelar». El foco va a «Cancelar» (la opción segura) y Escape cancela.
 * Dentro de un <form action={…}> envía el formulario al confirmar; con `onConfirm` ejecuta esa función en vez de enviar.
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  className,
  onConfirm,
  disabled,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  className: string;
  onConfirm?: () => void;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (asking) cancel.current?.focus();
  }, [asking]);

  if (!asking)
    return (
      <button type="button" disabled={disabled} onClick={() => setAsking(true)} className={className}>
        {label}
      </button>
    );

  return (
    <span
      role="alertdialog"
      aria-label={question}
      onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] bg-pink-50 px-3 py-2 text-[13px] text-pink-900"
    >
      <span className="font-bold">{question}</span>
      <span className="flex items-center gap-2">
        {onConfirm ? (
          <button
            type="button"
            onClick={() => {
              setAsking(false);
              onConfirm();
            }}
            className="min-h-11 rounded-full bg-pink-700 px-4 font-extrabold text-white hover:bg-pink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2"
          >
            {confirmLabel}
          </button>
        ) : (
          <button type="submit" className="min-h-11 rounded-full bg-pink-700 px-4 font-extrabold text-white hover:bg-pink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2">
            {confirmLabel}
          </button>
        )}
        <button
          ref={cancel}
          type="button"
          onClick={() => setAsking(false)}
          className="min-h-11 rounded-full border-[1.5px] border-slate-300 bg-white px-4 font-bold text-slate-700 hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
        >
          Cancelar
        </button>
      </span>
    </span>
  );
}
