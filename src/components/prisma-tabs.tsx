"use client";

import { useId, useRef, useState } from "react";

export type PrismaTabDef = { id: string; label: string; content: React.ReactNode };

/** Pestañas en píldora (roles ARIA y flechas del teclado). El contenido de todas se renderiza en el servidor; aquí solo se muestra una. */
export function PrismaTabs({ tabs, label, initial }: { tabs: PrismaTabDef[]; label: string; initial?: string }) {
  const [active, setActive] = useState(initial && tabs.some((t) => t.id === initial) ? initial : tabs[0].id);
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKey(e: React.KeyboardEvent, index: number) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = tabs[(index + dir + tabs.length) % tabs.length];
    setActive(next.id);
    refs.current[next.id]?.focus();
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label={label} className="flex max-w-full flex-wrap gap-2 self-start rounded-[28px] border border-slate-200 bg-white p-1.5">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`min-h-11 rounded-full px-5 text-sm font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 ${
              active === t.id ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-panel-${t.id}`} aria-labelledby={`${base}-tab-${t.id}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
