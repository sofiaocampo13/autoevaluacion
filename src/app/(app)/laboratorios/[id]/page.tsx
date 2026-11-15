import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";
import { formatSize, FILE_TYPES, CATEGORY_LABELS, extOf, type Category } from "@/lib/files";
import { LabForm } from "../lab-form";
import { UploadLabFiles } from "./upload-lab-files";
import { EvaluatePanel } from "./evaluar/evaluate-panel";
import { deleteLab, deleteLabFile, updateLab } from "../actions";

export const maxDuration = 60; // cada paso de la evaluación corre aquí; la IA puede tardar

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
    <section>
      <p className="mb-1 text-sm"><Link className="text-indigo-700 hover:underline" href="/laboratorios">← Mis laboratorios</Link></p>
      <h1 className="mb-4 text-2xl font-semibold">{lab.name}</h1>
      <Notice error={error} ok={ok} />

      <LabForm
        action={updateLab}
        lab={lab}
        guides={(mats ?? []).filter((m) => m.category === "guia")}
        rubrics={(mats ?? []).filter((m) => m.category === "rubrica")}
        submitLabel="Guardar cambios"
      />

      <div className="mb-6 max-w-xl rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-1 font-medium">Materiales asociados a este laboratorio</h2>
        {linked && linked.length > 0 ? (
          <ul className="mb-2 list-disc pl-5 text-sm text-slate-700">
            {linked.map((m) => (
              <li key={m.id}>
                {m.title} <span className="text-slate-500">· {CATEGORY_LABELS[m.category as Category]} · v{m.version}</span>
                {(m.id === lab.instructions_material_id || m.id === lab.rubric_material_id) && (
                  <span className="ml-1 rounded bg-indigo-50 px-1.5 text-xs text-indigo-700">en uso</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-2 text-sm text-slate-500">Ninguno todavía.</p>
        )}
        <Link href="/materiales" className="text-sm font-medium text-indigo-700 hover:underline">Ir a Materiales →</Link>
      </div>

      <div className="mb-6 max-w-xl rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-1 font-medium">Rúbrica parametrizada</h2>
        <p className="mb-3 text-sm text-slate-600">Interpreta tu rúbrica con IA, corrígela y confírmala antes de evaluar.</p>
        <Link href={`/laboratorios/${lab.id}/rubrica`} className="text-sm font-medium text-indigo-700 hover:underline">
          Abrir rúbrica →
        </Link>
      </div>

      <div className="mb-6 max-w-xl rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-1 font-medium">Evaluación con IA</h2>
        <p className="mb-3 text-sm text-slate-600">
          Valora cada criterio de tu rúbrica confirmada con citas de tus archivos. La nota es una estimación orientativa, no oficial.
        </p>
        <EvaluatePanel labId={lab.id} blockedReason={blockedReason} inProgress={inProgress} />
        {evaluations && evaluations.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-1 text-sm font-medium text-slate-800">Evaluaciones anteriores</h3>
            <ul className="divide-y divide-slate-100 text-sm">
              {evaluations.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-slate-600">
                    {new Date(e.created_at).toLocaleString("es")} · rúbrica v{e.rubric_version}
                  </span>
                  <span className="flex items-center gap-3">
                    {e.status === "completada" ? (
                      <b>{e.estimated_grade} / {e.grade_scale_max} · {e.overall_percent} %</b>
                    ) : (
                      <span className="text-slate-500">{e.status === "procesando" ? "en curso" : "no completada"}</span>
                    )}
                    <Link className="text-indigo-700 hover:underline" href={`/laboratorios/${id}/evaluacion/${e.id}`}>Ver</Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mb-6 max-w-xl rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-3 font-medium">Archivos del trabajo</h2>
        <UploadLabFiles labId={lab.id} />
        {files && files.length > 0 ? (
          <div>
            <p className="mb-2 text-sm text-slate-500">{files.length} archivo(s) en {folders.length} carpeta(s)</p>
            {folders.map(([dir, list]) => (
              <details key={dir} open={folders.length <= 3} className="mb-2 rounded-lg ring-1 ring-slate-200">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-800">
                  {dir || "(archivos sueltos)"} <span className="font-normal text-slate-500">· {list.length}</span>
                </summary>
                <ul className="divide-y divide-slate-100 px-3 pb-1 text-sm">
                  {list.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        {f.file_name}{" "}
                        <span className="text-slate-500">
                          · {FILE_TYPES[extOf(f.file_name)]?.label ?? "Archivo"} · {formatSize(f.size_bytes)}
                        </span>
                      </span>
                      <span className="flex gap-3">
                        <a
                          className="text-indigo-700 hover:underline"
                          href={`/descargar?path=${encodeURIComponent(f.storage_path)}&name=${encodeURIComponent(f.file_name)}`}
                        >
                          Descargar
                        </a>
                        <form action={deleteLabFile}>
                          <input type="hidden" name="id" value={f.id} />
                          <button className="text-red-600 hover:underline" type="submit">Eliminar</button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Todavía no hay archivos en este laboratorio.</p>
        )}

      </div>

      <form action={deleteLab}>
        <input type="hidden" name="id" value={lab.id} />
        <button type="submit" className="text-sm text-red-600 hover:underline">Eliminar este laboratorio y sus archivos</button>
      </form>
    </section>
  );
}
