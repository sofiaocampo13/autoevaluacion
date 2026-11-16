import type { Metadata } from "next";
import { PendingButton } from "@/components/pending-button";
import { confirmToken } from "./actions";

export const metadata: Metadata = { title: "Confirmar", robots: { index: false, follow: false } };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const { token_hash, type, next } = await searchParams;
  const recovery = type === "recovery";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h1 className="mb-2 text-xl font-semibold text-slate-900">{recovery ? "Restablecer contraseña" : "Confirmar tu correo"}</h1>
        {token_hash ? (
          <form action={confirmToken}>
            <input type="hidden" name="token_hash" value={token_hash} />
            <input type="hidden" name="type" value={type ?? "email"} />
            <input type="hidden" name="next" value={next ?? "/"} />
            <p className="mb-4 text-sm text-slate-600">
              {recovery ? "Pulsa el botón para continuar y elegir una contraseña nueva." : "Pulsa el botón para activar tu cuenta y entrar a la plataforma."}
            </p>
            <PendingButton className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900" pendingText="Un momento…">
              {recovery ? "Continuar" : "Confirmar mi correo"}
            </PendingButton>
          </form>
        ) : (
          <p className="text-sm text-slate-600">Este enlace no es válido. Abre de nuevo el que te llegó por correo.</p>
        )}
      </div>
    </main>
  );
}
