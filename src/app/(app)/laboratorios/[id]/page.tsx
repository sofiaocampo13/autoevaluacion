import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { Notice, Note } from "@/components/ui";
import { GRADE_DISCLAIMER } from "@/lib/scoring";
import { ConfirmButton } from "@/components/confirm-button";
import { AI_COST } from "@/lib/ai-budget";
import { formatSize, FILE_TYPES, CATEGORY_LABELS, extOf, type Category } from "@/lib/files";
import { LabForm } from "../lab-form";
import { UploadLabFiles } from "./upload-lab-files";
import { EvalSteps } from "./eval-steps";
import { EvaluatePanel } from "./evaluar/evaluate-panel";
import { deleteLab, deleteLabFile, updateLab } from "../actions";

export const maxDuration = 300; // cada paso de la evaluación y «rellenar con IA» corren aquí; la IA puede tardar

const card = "flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-[22px] py-5";
const link = "inline-flex min-h-11 items-center px-2 text-[14px] font-bold text-brand-700 underline hover:text-brand-800";

export default async function LabDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { error, ok } = await searchParams;

  const supabase = await createClient();
  const { data: lab } = await supabase.from("labs").select("*").eq("id", id).maybeSingle();
  if (!lab) notFound(); // también cubre laboratorios de otro usuario (RLS)

  const [{ data: files }, { data: mats }, { data: linked }] = await Promise.all([
    supabase.from("lab_files").select("*").eq("lab_id", id).order("created_at"),
    supabase.from("reference_materials").select("id, title, version, category").in("category", ["guia", "rubrica"]),
    supabase.from("reference_materials").select("id, title, version, category").eq("lab_id", id).order("created_at"),
  ]);

  const [{ data: confirmedList }, { data: evaluations }] = await Promise.all([
    supabase.from("rubrics").select("version").eq("lab_id", id).eq("status", "confirmada").order("version", { ascending: false }).limit(1),
    supabase.from("evaluations").select("id, status, created_at, estimated_grade, grade_scale_max, overall_percent, rubric_version").eq("lab_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const confirmedVersion = confirmedList?.[0]?.version ?? null;
  const hasWork = !!files?.length || !!lab.repo_url;
  const hasCompleted = !!evaluations?.some((e) => e.status === "completada");
  const blockedReason = confirmedVersion == null
    ? "Primero interpreta y confirma la rúbrica de este laboratorio."
    : !hasWork
      ? "Sube los archivos del trabajo (o indica un repositorio) para poder evaluar."
      : null;
  const inProgress = !!evaluations?.some((e) => e.status === "procesando");

  // Agrupa por carpeta (ruta relativa sin el nombre del archivo).
  const byDir = new Map<string, NonNullable<typeof files>>();
  for (const f of files ?? []) {
    const dir = f.relative_path.includes("/") ? f.relative_path.slice(0, f.relative_path.lastIndexOf("/")) : "";
    byDir.set(dir, [...(byDir.get(dir) ?? []), f]);
  }
  const folders = [...byDir.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <Link className="inline-flex min-h-11 w-fit items-center text-[14px] font-bold text-brand-700 hover:underline" href="/laboratorios">← Mis laboratorios</Link>
        <h1 className="text-[32px] leading-tight tracking-[-0.02em] sm:text-[44px]">{lab.name}</h1>
      </header>
      <Notice error={error} ok={ok} />

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-5">
          <LabForm
            action={updateLab}
            lab={lab}
            guides={(mats ?? []).filter((m) => m.category === "guia")}
            rubrics={(mats ?? []).filter((m) => m.category === "rubrica")}
            submitLabel="Guardar cambios"
          />

          <div className={card}>
            <h2 className="text-[22px]">Archivos del trabajo</h2>
            <UploadLabFiles labId={lab.id} />
            {files && files.length > 0 ? (
              <div>
                <p className="mb-2 text-[13px] font-bold text-slate-600">{files.length} archivo(s) en {folders.length} carpeta(s)</p>
                {folders.map(([dir, list]) => (
                  <details key={dir} open={folders.length <= 3} className="mb-2 rounded-2xl border border-slate-100">
                    <summary className="min-h-11 cursor-pointer px-3.5 py-2.5 text-[14px] font-bold text-slate-800">
                      {dir || "(archivos sueltos)"} <span className="font-normal text-slate-600">· {list.length}</span>
                    </summary>
                    <ul className="divide-y divide-slate-100 px-3.5 pb-1 text-[14px]">
                      {list.map((f) => (
                        <li key={f.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1">
                          <span className="min-w-0 break-words">
                            <strong>{f.file_name}</strong>{" "}
                            <span className="text-slate-600">
                              · {FILE_TYPES[extOf(f.file_name)]?.label ?? "Archivo"} · {formatSize(f.size_bytes)}
                            </span>
                          </span>
                          <span className="flex gap-1">
                            <a
                              className={link}
                              href={`/descargar?path=${encodeURIComponent(f.storage_path)}&name=${encodeURIComponent(f.file_name)}`}
                            >
                              Descargar
                            </a>
                            <form action={deleteLabFile} className="flex">
                              <input type="hidden" name="id" value={f.id} />
                              <ConfirmButton label="Eliminar" question={`¿Eliminar «${f.file_name}»?`} confirmLabel="Sí, eliminar" className="min-h-11 px-2 text-[13.5px] font-bold text-red-700 hover:underline" />
                            </form>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-slate-600">Todavía no hay archivos en este laboratorio.</p>
            )}
          </div>
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-[18px]">
          <EvalSteps done={[confirmedVersion != null, hasWork, hasCompleted, hasCompleted]} />

          <div className={card}>
            <h2 className="text-[22px]">Rúbrica parametrizada</h2>
            {confirmedVersion != null && (
              <span className="w-fit rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-extrabold text-blue-800">Versión {confirmedVersion} · confirmada</span>
            )}
            <p className="text-[14px] text-slate-600">Interpreta tu rúbrica con IA, corrígela y confírmala antes de evaluar.</p>
            <Link href={`/laboratorios/${lab.id}/rubrica`} className={link}>
              Abrir rúbrica →
            </Link>
          </div>

          <div className="flex flex-col gap-3.5 rounded-3xl bg-slate-900 p-[22px] text-slate-50">
            <h2 className="text-[22px]">Evaluación con IA</h2>
            <p className="text-[13.5px] leading-normal text-slate-200">
              Valora cada criterio de tu rúbrica confirmada con citas de tus archivos. La nota es una estimación orientativa, no oficial.
            </p>
            <EvaluatePanel labId={lab.id} blockedReason={blockedReason} inProgress={inProgress} cost={AI_COST.evaluacion} />
            {evaluations && evaluations.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-plum-line pt-3">
                <h3 className="font-sans text-[13px] font-extrabold">Evaluaciones anteriores</h3>
                <ul className="text-[13px]">
                  {evaluations.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1">
                      <span className="text-slate-200">
                        {new Date(e.created_at).toLocaleString("es")} · rúbrica v{e.rubric_version}
                      </span>
                      <span className="flex items-center gap-3">
                        {e.status === "completada" ? (
                          <b className="text-white">{e.estimated_grade} / {e.grade_scale_max} · {e.overall_percent} %</b>
                        ) : (
                          <span className="text-slate-200">{e.status === "procesando" ? "en curso" : "no completada"}</span>
                        )}
                        <Link className="inline-flex min-h-11 items-center font-extrabold text-lavanda underline hover:text-white" href={`/laboratorios/${id}/evaluacion/${e.id}`}>Ver</Link>
                        {e.status === "completada" && (
                          <Link className="inline-flex min-h-11 items-center font-extrabold text-pink-300 underline hover:text-white" href={`/laboratorios/${id}/evaluacion/${e.id}?tab=revision`}>Enviar al docente</Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {evaluations.some((e) => e.status === "completada") && (
                  <div className="mt-1">
                    <Note>{GRADE_DISCLAIMER}</Note>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={card}>
            <h2 className="text-[22px]">Materiales asociados</h2>
            {linked && linked.length > 0 ? (
              <ul className="flex flex-col gap-1.5 text-[14px] text-slate-800">
                {linked.map((m) => (
                  <li key={m.id}>
                    {m.title} <span className="text-slate-600">· {CATEGORY_LABELS[m.category as Category]} · v{m.version}</span>
                    {(m.id === lab.instructions_material_id || m.id === lab.rubric_material_id) && (
                      <span className="ml-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-bold text-brand-800">en uso</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-slate-600">Ninguno todavía.</p>
            )}
            <Link href="/materiales" className={link}>Ir a Materiales →</Link>
          </div>
        </aside>
      </div>

      <form action={deleteLab}>
        <input type="hidden" name="id" value={lab.id} />
        <ConfirmButton
          label="Eliminar este laboratorio y sus archivos"
          question={`Se eliminarán el laboratorio, sus ${files?.length ?? 0} archivo(s) y sus ${evaluations?.length ?? 0} evaluación(es). No se puede deshacer.`}
          confirmLabel="Sí, eliminar todo"
          className="min-h-11 text-[14px] font-bold text-red-700 hover:underline"
        />
      </form>
    </section>
  );
}
