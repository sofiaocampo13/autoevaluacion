import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { PendingButton } from "@/components/pending-button";
import { Notice } from "@/components/ui";
import { confirmToken } from "./actions";

export const metadata: Metadata = { title: "Confirmar", robots: { index: false, follow: false } };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const { token_hash, type, next } = await searchParams;
  const recovery = type === "recovery";
  const tagline = recovery ? (
    <>Una contraseña nueva y <em className="text-pink-300">sigues donde ibas</em>.</>
  ) : (
    <>Un paso más y <em className="text-pink-300">empiezas a autoevaluarte</em>.</>
  );

  return (
    <AuthShell tagline={tagline}>
      {token_hash ? (
        <form action={confirmToken} className="flex flex-col gap-4">
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type ?? "email"} />
          <input type="hidden" name="next" value={next ?? "/"} />
          <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-50 text-brand-600">
            <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
            </svg>
          </span>
          <h1 className="font-display text-3xl font-medium text-slate-800">{recovery ? "Restablecer contraseña" : "Confirmar tu correo"}</h1>
          <p className="text-[15px] leading-relaxed text-slate-600">
            {recovery ? "Pulsa el botón para continuar y elegir una contraseña nueva." : "Pulsa el botón para activar tu cuenta y entrar a la plataforma."}
          </p>
          <PendingButton className="flex min-h-[52px] w-full items-center justify-center rounded-full bg-brand-600 px-5 text-[15px] font-extrabold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2" pendingText="Un momento…">
            {recovery ? "Continuar" : "Confirmar mi correo"}
          </PendingButton>
        </form>
      ) : (
        <div>
          <h1 className="mb-4 font-display text-3xl font-medium text-slate-800">{recovery ? "Restablecer contraseña" : "Confirmar tu correo"}</h1>
          <Notice error="Este enlace no es válido. Abre de nuevo el que te llegó por correo." />
        </div>
      )}
    </AuthShell>
  );
}
