import { Field, Notice, SubmitButton } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { register } from "../actions";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form action={register}>
      <h1 className="mb-5 font-display text-3xl font-medium text-slate-800">Crea tu espacio personal</h1>
      <Notice error={error} />
      <Field label="Nombre completo" name="fullName" autoComplete="name" required />
      <Field label="Correo" name="email" type="email" autoComplete="email" required />
      <PasswordField label="Contraseña (mínimo 8 caracteres)" name="password" autoComplete="new-password" minLength={8} required />
      <label className="mb-4 flex gap-2.5 text-[13px] leading-snug text-slate-600">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
        <span>
          Entiendo que mis documentos se envían a un servicio de IA gratuito (Google Gemini) para ser analizados, y que
          en esa capa el proveedor puede usar los datos para mejorar sus modelos. No subiré información de terceros ni
          datos sensibles. Las notas son estimaciones orientativas, no oficiales.
        </span>
      </label>
      <SubmitButton>Crear mi cuenta</SubmitButton>
      <p className="mt-6 text-center text-xs leading-normal text-slate-500">Te enviaremos un correo para confirmar tu cuenta. Puedes eliminar tus datos cuando quieras desde tu perfil.</p>
    </form>
  );
}
