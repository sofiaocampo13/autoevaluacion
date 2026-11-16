import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { Notice } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { PendingButton } from "@/components/pending-button";
import { setNewPassword } from "./actions";

export const metadata: Metadata = { title: "Elegir contraseña nueva", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell tagline={<>Una contraseña nueva y <em className="text-pink-300">sigues donde ibas</em>.</>}>
      <form action={setNewPassword}>
        <h1 className="mb-3 font-display text-3xl font-medium text-slate-800">Elige tu contraseña nueva</h1>
        <p className="mb-5 text-[15px] leading-relaxed text-slate-600">Usa al menos 8 caracteres.</p>
        <Notice error={error} />
        <PasswordField label="Contraseña nueva" name="password" autoComplete="new-password" minLength={8} required />
        <PasswordField label="Repite la contraseña" name="confirm" autoComplete="new-password" minLength={8} required />
        <PendingButton className="flex min-h-[52px] w-full items-center justify-center rounded-full bg-brand-600 px-5 text-[15px] font-extrabold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2" pendingText="Guardando…">
          Guardar contraseña
        </PendingButton>
      </form>
    </AuthShell>
  );
}
