import type { Metadata } from "next";
import { Notice } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { PendingButton } from "@/components/pending-button";
import { setNewPassword } from "./actions";

export const metadata: Metadata = { title: "Elegir contraseña nueva", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form action={setNewPassword} className="w-full max-w-sm rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Elige tu contraseña nueva</h1>
        <p className="mb-4 text-sm text-slate-600">Usa al menos 8 caracteres.</p>
        <Notice error={error} />
        <PasswordField label="Contraseña nueva" name="password" autoComplete="new-password" minLength={8} required />
        <PasswordField label="Repite la contraseña" name="confirm" autoComplete="new-password" minLength={8} required />
        <PendingButton className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900" pendingText="Guardando…">
          Guardar contraseña
        </PendingButton>
      </form>
    </main>
  );
}
