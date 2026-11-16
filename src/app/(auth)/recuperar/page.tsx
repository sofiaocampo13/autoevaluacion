import Link from "next/link";
import { Field, Notice, SubmitButton } from "@/components/ui";
import { requestReset } from "../actions";

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  return (
    <form action={requestReset}>
      <h1 className="mb-3 font-display text-3xl font-medium text-slate-800">Recupera tu contraseña</h1>
      <p className="mb-5 text-[15px] leading-relaxed text-slate-600">Escribe tu correo y te enviaremos un enlace.</p>
      {/* El envío es informativo (no confirma si el correo existe): se muestra en azul, no como éxito. */}
      <Notice error={error} info={ok} />
      <Field label="Correo de tu cuenta" name="email" type="email" autoComplete="email" required />
      <SubmitButton>Enviar enlace</SubmitButton>
      <p className="mt-3 text-center text-sm font-bold">
        <Link className="inline-flex min-h-11 items-center text-brand-600 underline hover:text-brand-700" href="/login">Volver a iniciar sesión</Link>
      </p>
    </form>
  );
}
