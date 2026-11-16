"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";

/**
 * Envuelve la infografía general y ofrece descargarla como imagen PNG. El botón queda fuera del área capturada,
 * así que la imagen trae solo la infografía (título, cifras, temas, leyenda y resumen).
 */
export function InfographicCapture({ children, filename }: { children: React.ReactNode; filename: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    if (!ref.current) return;
    setBusy(true);
    setError(null);
    try {
      const url = await toPng(ref.current, { pixelRatio: 2, backgroundColor: "#faf7fd", cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60)}.png`;
      a.click();
    } catch {
      setError("No se pudo generar la imagen. Inténtalo de nuevo o usa la captura de pantalla de tu sistema.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
        {error && <p role="alert" className="text-sm font-bold text-pink-700">{error}</p>}
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="min-h-11 rounded-full bg-brand-600 px-5 text-[13px] font-extrabold text-white hover:bg-brand-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
        >
          {busy ? "Generando imagen…" : "Descargar infografía (PNG)"}
        </button>
      </div>
      <div ref={ref} className="space-y-6 rounded-[24px] bg-slate-50 p-6">
        {children}
      </div>
    </div>
  );
}
