import Link from "next/link";
import { Field, Notice, SubmitButton } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { register } from "../actions";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form action={register}>
      <Notice error={error} />
      <Field label="Nombre completo" name="fullName" autoComplete="name" required />
      <Field label="Correo" name="email" type="email" autoComplete="email" required />
      <PasswordField label="Contraseña (mínimo 8 caracteres)" name="password" autoComplete="new-password" minLength={8} required />
      <label className="mb-4 flex gap-2 text-sm text-slate-600">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>
          Entiendo que mis documentos se envían a un servicio de IA gratuito (Google Gemini) para ser analizados, y que
          en esa capa el proveedor puede usar los datos para mejorar sus modelos. No subiré información de terceros ni
          datos sensibles. Las notas son estimaciones orientativas, no oficiales.
        </span>
      </label>
      <SubmitButton>Crear cuenta</SubmitButton>
      <p className="mt-4 text-sm text-slate-600">
        ¿Ya tienes cuenta? <Link className="text-indigo-700 hover:underline" href="/login">Inicia sesión</Link>
      </p>
    </form>
  );
}
