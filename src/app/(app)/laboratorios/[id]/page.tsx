import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { Notice, Note } from "@/components/ui";
import { GRADE_DISCLAIMER } from "@/lib/scoring";
import { formatSize, FILE_TYPES, CATEGORY_LABELS, extOf, type Category } from "@/lib/files";
import { LabForm } from "../lab-form";
import { UploadLabFiles } from "./upload-lab-files";
import { EvaluatePanel } from "./evaluar/evaluate-panel";
import { deleteLab, deleteLabFile, updateLab } from "../actions";

export const maxDuration = 300; // cada paso de la evaluación y «rellenar con IA» corren aquí; la IA puede tardar

const card = "flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-[26px] py-6";
const link = "text-[14px] font-bold text-brand-700 hover:underline";

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

  const [{ count: confirmedRubrics }, { data: evaluations }] = await Promise.all([
    supabase.from("rubrics").select("id", { count: "exact", head: true }).eq("lab_id", id).eq("status", "confirmada"),
    supabase.from("evaluations").select("id, status, created_at, estimated_grade, grade_scale_max, overall_percent, rubric_version").eq("lab_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const blockedReason = !confirmedRubrics
    ? "Primero interpreta y confirma la rúbrica de este laboratorio."
    : !files?.length && !lab.repo_url
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
        <Link className="text-[14px] font-bold text-brand-700 hover:underline" href="/laboratorios">← Mis laboratorios</Link>
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
                <p className="mb-2 text-[13px] text-slate-600">{files.length} archivo(s) en {folders.length} carpeta(s)</p>
                {folders.map(([dir, list]) => (
                  <details key={dir} open={folders.length <= 3} className="mb-2 rounded-2xl border border-slate-200">
                    <summary className="min-h-11 cursor-pointer px-3.5 py-2.5 text-[14px] font-bold text-slate-800">
                      {dir || "(archivos sueltos)"} <span className="font-normal text-slate-600">· {list.length}</span>
                    </summary>
                    <ul className="divide-y divide-slate-100 px-3.5 pb-1 text-[14px]">
                      {list.map((f) => (
                        <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <span className="min-w-0 break-words">
                            {f.file_name}{" "}
                            <span className="text-slate-600">
                              · {FILE_TYPES[extOf(f.file_name)]?.label ?? "Archivo"} · {formatSize(f.size_bytes)}
                            </span>
                          </span>
                          <span className="flex gap-4">
                            <a
                              className={link}
                              href={`/descargar?path=${encodeURIComponent(f.storage_path)}&name=${encodeURIComponent(f.file_name)}`}
                            >
                              Descargar
                            </a>
                            <form action={deleteLabFile}>
                              <input type="hidden" name="id" value={f.id} />
                              <button className="text-[14px] font-bold text-red-700 hover:underline" type="submit">Eliminar</button>
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

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <div className={card}>
            <h2 className="text-[22px]">Rúbrica parametrizada</h2>
            <p className="text-[14px] text-slate-600">Interpreta tu rúbrica con IA, corrígela y confírmala antes de evaluar.</p>
            <Link href={`/laboratorios/${lab.id}/rubrica`} className={link}>
              Abrir rúbrica →
            </Link>
          </div>

          <div className={card}>
            <h2 className="text-[22px]">Evaluación con IA</h2>
            <p className="text-[14px] text-slate-600">
              Valora cada criterio de tu rúbrica confirmada con citas de tus archivos. La nota es una estimación orientativa, no oficial.
            </p>
            <EvaluatePanel labId={lab.id} blockedReason={blockedReason} inProgress={inProgress} />
            {evaluations && evaluations.length > 0 && (
              <div className="mt-2">
                <h3 className="mb-1 font-sans text-[14px] font-extrabold text-slate-800">Evaluaciones anteriores</h3>
                <ul className="divide-y divide-slate-100 text-[14px]">
                  {evaluations.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="text-slate-600">
                        {new Date(e.created_at).toLocaleString("es")} · rúbrica v{e.rubric_version}
                      </span>
                      <span className="flex items-center gap-3">
                        {e.status === "completada" ? (
                          <b>{e.estimated_grade} / {e.grade_scale_max} · {e.overall_percent} %</b>
                        ) : (
                          <span className="text-slate-600">{e.status === "procesando" ? "en curso" : "no completada"}</span>
                        )}
                        <Link className={link} href={`/laboratorios/${id}/evaluacion/${e.id}`}>Ver</Link>
                      </span>
                    </li>
                  ))}
                </ul>
                {evaluations.some((e) => e.status === "completada") && (
                  <div className="mt-3">
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
        <button type="submit" className="min-h-11 text-[14px] font-bold text-red-700 hover:underline">Eliminar este laboratorio y sus archivos</button>
      </form>
    </section>
  );
}
