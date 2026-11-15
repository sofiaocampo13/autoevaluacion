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
      <Notice error={error} ok={ok} />
      <Field label="Correo" name="email" type="email" autoComplete="email" required />
      <PasswordField label="Contraseña" name="password" autoComplete="current-password" required />
      <SubmitButton>Iniciar sesión</SubmitButton>
      <p className="mt-4 flex justify-between text-sm text-slate-600">
        <Link className="text-indigo-700 hover:underline" href="/registro">Crear cuenta</Link>
        <Link className="text-indigo-700 hover:underline" href="/recuperar">Olvidé mi contraseña</Link>
      </p>
    </form>
  );
}
