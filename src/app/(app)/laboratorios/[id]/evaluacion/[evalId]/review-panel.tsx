"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLink, revokeLink } from "./review-actions";

export type LinkRow = { id: string; createdAt: string; expiresAt: string; state: string; label: string; lastViewedAt: string | null };

export function ReviewLinkPanel({ evaluationId, links, canCreate }: { evaluationId: string; links: LinkRow[]; canCreate: boolean }) {
  const router = useRouter();
  const [fresh, setFresh] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function create() {
    setError(null);
    setCopied(false);
    start(async () => {
      const r = await createLink(evaluationId);
      if (!r.ok) return setError(r.error);
      setFresh({ url: r.url, expiresAt: r.expiresAt });
      router.refresh();
    });
  }

  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.url);
      setCopied(true);
    } catch {
      setError("No se pudo copiar automáticamente. Selecciona el enlace y cópialo a mano.");
    }
  }

  function revoke(id: string) {
    start(async () => {
      await revokeLink(id);
      setFresh(null);
      router.refresh();
    });
  }

  return (
    <div>
      {canCreate && (
        <div className="mb-4">
          <button
            onClick={create}
            disabled={pending}
            className="min-h-11 rounded-full bg-brand-600 px-5 text-sm font-extrabold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {pending ? "Creando…" : "Generar enlace de revisión"}
          </button>
          <p className="mt-2 text-xs text-slate-600">El enlace dura 14 días, lo puede abrir cualquier persona que lo tenga (sin cuenta) y puedes revocarlo cuando quieras.</p>
        </div>
      )}

      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {fresh && (
        <div role="status" className="mb-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <p className="font-medium">Enlace creado. Cópialo ahora: por seguridad no se vuelve a mostrar.</p>
          <input readOnly value={fresh.url} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace de revisión" className="mt-2 block min-h-11 w-full rounded-xl border border-emerald-300 bg-white px-3 font-mono text-xs" />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button onClick={copy} className="min-h-11 rounded-full bg-emerald-700 px-5 font-bold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2">{copied ? "¡Copiado!" : "Copiar enlace"}</button>
            <span className="text-xs">Vence el {new Date(fresh.expiresAt).toLocaleDateString("es")}</span>
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-bold text-slate-800">Enlaces creados</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-slate-600">
                  Creado {new Date(l.createdAt).toLocaleDateString("es")} · vence {new Date(l.expiresAt).toLocaleDateString("es")}
                  {l.lastViewedAt && ` · abierto por última vez ${new Date(l.lastViewedAt).toLocaleString("es")}`}
                </span>
                <span className="flex items-center gap-3">
                  <span className={l.state === "activo" ? "font-bold text-emerald-700" : "text-slate-600"}>{l.label}</span>
                  {l.state === "activo" && (
                    <button onClick={() => revoke(l.id)} disabled={pending} className="min-h-11 px-2 font-bold text-red-700 hover:underline disabled:opacity-60">Revocar</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
