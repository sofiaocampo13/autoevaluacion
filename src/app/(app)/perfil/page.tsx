import { createClient } from "@/lib/supabase/server";
import { Field, Notice, SubmitButton } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { formatSize } from "@/lib/files";
import { getStorageQuota } from "@/lib/storage-quota";
import { changePassword, updateProfile, updateSubject } from "../actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name, ai_consent_at").single();
  const { data: subjects } = await supabase.from("subjects").select("*").order("created_at").limit(1);
  const subject = subjects?.[0];
  const quota = await getStorageQuota(supabase);
  const usedPct = quota ? Math.min(100, Math.round((quota.usedBytes / quota.limitBytes) * 100)) : 0;

  const card = "mb-6 max-w-md rounded-xl bg-white p-6 ring-1 ring-slate-200";
  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold">Mi perfil</h1>
      <Notice error={error} ok={ok} />

      <form action={updateProfile} className={card}>
        <h2 className="mb-3 font-medium">Datos personales</h2>
        <p className="mb-3 text-sm text-slate-500">
          {auth.user?.email}
          {profile?.ai_consent_at && ` · consentimiento de IA: ${new Date(profile.ai_consent_at).toLocaleDateString("es")}`}
        </p>
        <Field label="Nombre completo" name="fullName" defaultValue={profile?.full_name ?? ""} required />
        <SubmitButton>Guardar</SubmitButton>
      </form>

      {subject && (
        <form action={updateSubject} className={card}>
          <h2 className="mb-3 font-medium">Asignatura</h2>
          <input type="hidden" name="id" value={subject.id} />
          <Field label="Nombre" name="name" defaultValue={subject.name} required />
          <Field label="Periodo académico" name="period" defaultValue={subject.academic_period} />
          <label className="mb-4 block text-sm font-medium text-slate-700">
            Escala de calificación
            <select
              name="scale"
              defaultValue={String(subject.grade_scale_max)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="5">0 a 5</option>
              <option value="100">0 a 100</option>
            </select>
          </label>
          <SubmitButton>Guardar</SubmitButton>
        </form>
      )}

      {quota && (
        <div className={card}>
          <h2 className="mb-3 font-medium">Almacenamiento</h2>
          <p className="mb-2 text-sm text-slate-700">
            {formatSize(quota.usedBytes)} de {formatSize(quota.limitBytes)} · {quota.usedFiles} de {quota.limitFiles} archivos
          </p>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Almacenamiento usado">
            <div className={`h-full rounded-full ${usedPct >= 90 ? "bg-orange-500" : "bg-emerald-500"}`} style={{ width: `${usedPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Cuenta tus archivos de laboratorios y materiales. Al llegar al límite no podrás subir más hasta eliminar algunos.</p>
        </div>
      )}

      <form action={changePassword} className={card}>
        <h2 className="mb-3 font-medium">Cambiar contraseña</h2>
        <PasswordField label="Nueva contraseña" name="password" autoComplete="new-password" minLength={8} required />
        <SubmitButton>Actualizar contraseña</SubmitButton>
      </form>
    </section>
  );
}
