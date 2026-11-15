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
      <Notice error={error} ok={ok} />
      <Field label="Correo de tu cuenta" name="email" type="email" autoComplete="email" required />
      <SubmitButton>Enviar enlace</SubmitButton>
      <p className="mt-4 text-sm"><Link className="text-indigo-700 hover:underline" href="/login">Volver</Link></p>
    </form>
  );
}
