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
      <h1 className="mb-5 font-display text-3xl font-medium text-slate-800">Recupera tu contraseña</h1>
      <p className="-mt-3 mb-5 text-sm text-slate-600">Escribe tu correo y te enviaremos un enlace.</p>
      <Notice error={error} ok={ok} />
      <Field label="Correo de tu cuenta" name="email" type="email" autoComplete="email" required />
      <SubmitButton>Enviar enlace</SubmitButton>
      <p className="mt-5 text-center text-[13px] font-bold"><Link className="text-brand-600 hover:text-brand-700" href="/login">Volver a iniciar sesión</Link></p>
    </form>
  );
}
