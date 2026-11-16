import type { Metadata } from "next";
import Link from "next/link";
import { ErrorPageShell, linkPrimary, linkSecondary } from "@/components/error-page-shell";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <ErrorPageShell mark="404" markClass="text-brand-200" title="Esta página no existe" description="Puede que el enlace esté mal escrito o que la página se haya movido. Tus laboratorios y evaluaciones siguen a salvo.">
      <Link href="/" className={linkPrimary}>Ir al inicio</Link>
      <Link href="/laboratorios" className={linkSecondary}>Mis laboratorios</Link>
    </ErrorPageShell>
  );
}
