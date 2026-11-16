import { createClient } from "@/lib/supabase/server";
import { Field, Notice } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { formatSize } from "@/lib/files";
import { getStorageQuota } from "@/lib/storage-quota";
import { changePassword, deleteAccount, updateProfile, updateSubject } from "../actions";
import { PendingButton } from "@/components/pending-button";

const card = "flex flex-col rounded-3xl border border-slate-200 bg-white px-6 py-[22px]";
const cardTitle = "mb-4 font-display text-[22px]";
const saveBtn =
  "flex min-h-[46px] items-center justify-center self-start rounded-full bg-brand-600 px-6 text-sm font-extrabold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2";

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

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-4xl tracking-tight text-slate-900 sm:text-[44px]">Mi perfil</h1>
      <Notice error={error} ok={ok} />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <form action={updateProfile} className={card}>
          <h2 className={cardTitle}>Datos personales</h2>
          <div className="mb-4 flex flex-col gap-1 rounded-[14px] bg-slate-50 px-3.5 py-3">
            <span className="text-xs font-bold text-slate-600">Correo</span>
            <span className="break-all text-sm font-bold text-slate-800">{auth.user?.email}</span>
            {profile?.ai_consent_at && (
              <span className="text-[12.5px] text-slate-600">
                Consentimiento de IA: {new Date(profile.ai_consent_at).toLocaleDateString("es")}
              </span>
            )}
          </div>
          <Field label="Nombre completo" name="fullName" defaultValue={profile?.full_name ?? ""} required />
          <button type="submit" className={saveBtn}>
            Guardar
          </button>
        </form>

        {subject && (
          <form action={updateSubject} className={card}>
            <h2 className={cardTitle}>Asignatura</h2>
            <input type="hidden" name="id" value={subject.id} />
            <Field label="Nombre" name="name" defaultValue={subject.name} required />
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Field label="Periodo académico" name="period" defaultValue={subject.academic_period} />
              <label className="mb-4 flex flex-col gap-1.5 text-[13px] font-bold text-slate-800">
                Escala de calificación
                <select
                  name="scale"
                  defaultValue={String(subject.grade_scale_max)}
                  className="min-h-12 rounded-[14px] border-[1.5px] border-slate-300 bg-white px-3 text-[15px] font-normal text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  <option value="5">0 a 5</option>
                  <option value="100">0 a 100</option>
                </select>
              </label>
            </div>
            <button type="submit" className={saveBtn}>
              Guardar
            </button>
          </form>
        )}

        {quota && (
          <div className={card}>
            <h2 className={cardTitle}>Almacenamiento</h2>
            <p className="mb-3 text-[15px] font-extrabold text-slate-800">
              {formatSize(quota.usedBytes)} de {formatSize(quota.limitBytes)} · {quota.usedFiles} de {quota.limitFiles} archivos
            </p>
            <div
              className="h-3.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={usedPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Almacenamiento usado"
            >
              <div className={`h-full rounded-full ${usedPct >= 90 ? "bg-orange-500" : "bg-brand-600"}`} style={{ width: `${usedPct}%` }} />
            </div>
            <p className="mt-3 text-[13px] leading-normal text-slate-600">
              {usedPct >= 90 && <b className="text-aviso-text">Almacenamiento casi lleno. </b>}
              Cuenta tus archivos de laboratorios y materiales. Al llegar al límite no podrás subir más hasta eliminar algunos.
            </p>
          </div>
        )}

        <form action={changePassword} className={card}>
          <h2 className={cardTitle}>Cambiar contraseña</h2>
          <PasswordField label="Nueva contraseña" name="password" autoComplete="new-password" minLength={8} required />
          <button type="submit" className={saveBtn}>
            Actualizar contraseña
          </button>
        </form>
      </div>

      <details className="max-w-[760px] rounded-3xl border-[1.5px] border-pink-200 bg-white px-6 py-[18px]">
        <summary className="min-h-8 cursor-pointer text-base font-extrabold text-pink-700">Eliminar mi cuenta y mis datos</summary>
        <form action={deleteAccount} className="mt-3 flex flex-col">
          <p className="mb-3 text-sm leading-relaxed text-slate-600">
            Se borran <b>para siempre</b> tu cuenta y todo lo que subiste o generaste: archivos, laboratorios, rúbricas, evaluaciones, informes, análisis y enlaces de revisión. No se puede deshacer.
          </p>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">Si quieres conservar algo, descárgalo antes (informes PDF, infografías, archivos).</p>
          <Field label={`Escribe tu correo (${auth.user?.email ?? ""}) para confirmar`} name="email" type="email" autoComplete="off" required />
          <PasswordField label="Tu contraseña actual" name="password" autoComplete="current-password" required />
          <PendingButton
            className="min-h-12 rounded-full bg-red-700 px-6 text-sm font-extrabold text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2"
            pendingText="Eliminando tu cuenta…"
            hint="puede tardar unos segundos"
          >
            Eliminar mi cuenta definitivamente
          </PendingButton>
        </form>
      </details>
    </section>
  );
}
