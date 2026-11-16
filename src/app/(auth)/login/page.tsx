import Link from "next/link";
import { Field, Notice, SubmitButton } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { login } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  return (
    <form action={login}>
      <h1 className="mb-5 font-display text-3xl font-medium text-slate-800">Te damos la bienvenida</h1>
      <Notice error={error} ok={ok} />
      <Field label="Correo" name="email" type="email" autoComplete="email" required />
      <PasswordField label="Contraseña" name="password" autoComplete="current-password" required />
      <p className="-mt-2 mb-4 text-right text-[13px] font-bold">
        <Link className="text-brand-600 hover:text-brand-700" href="/recuperar">¿Olvidaste tu contraseña?</Link>
      </p>
      <SubmitButton>Entrar</SubmitButton>
      <p className="mt-6 text-center text-xs leading-normal text-slate-500">
        Tus archivos se almacenan cifrados y solo tú puedes verlos. Puedes eliminarlos cuando quieras desde tu perfil.
      </p>
      <p className="mt-3 text-center text-xs"><Link className="text-slate-500 hover:text-slate-800 hover:underline" href="/acerca">Acerca del proyecto y el equipo</Link></p>
    </form>
  );
}
