"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorPageShell, linkSecondary } from "@/components/error-page-shell";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorPageShell mark="¡Uy!" markClass="text-pink-300" title="Algo salió mal" description="Ocurrió un error inesperado. Puedes reintentar; si se repite, vuelve al inicio.">
      <button
        type="button"
        onClick={() => retry()}
        className="min-h-[50px] rounded-full bg-pink-600 px-6 text-sm font-extrabold text-white hover:bg-pink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2"
      >
        Reintentar
      </button>
      <Link href="/" className={linkSecondary}>Ir al inicio</Link>
      <Link href="/laboratorios" className={linkSecondary}>Mis laboratorios</Link>
    </ErrorPageShell>
  );
}
