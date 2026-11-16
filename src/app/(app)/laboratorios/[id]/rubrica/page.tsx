import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import type { Criterion } from "@/lib/rubric-validate";
import { RubricEditor } from "./rubric-editor";
import { createBlankRubric, deleteDraftRubric, newRubricVersion, parseRubric } from "./actions";

export const maxDuration = 300; // la interpretación con IA puede tardar más de un minuto si el modelo está saturado

export default async function RubricPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string; ok?: string; error?: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { v, ok, error } = await searchParams;

  const supabase = await createClient();
  const { data: lab } = await supabase
    .from("labs")
    .select("id, name, rubric_material_id, reference_materials!labs_rubric_material_id_fkey(title, version)")
    .eq("id", id)
    .maybeSingle();
  if (!lab) notFound();
  const { data: rubrics } = await supabase.from("rubrics").select("*").eq("lab_id", id).order("version", { ascending: false });

  const selected = rubrics?.find((r) => String(r.version) === v) ?? rubrics?.[0];
  const { data: rows } = selected
    ? await supabase.from("rubric_criteria").select("*").eq("rubric_id", selected.id).order("position")
    : { data: [] };
  const criteria: Criterion[] = (rows ?? []).map((r) => ({
    competency: r.competency,
    criterion: r.criterion,
    description: r.description,
    weight: r.weight,
    levels: r.levels,
  }));

  const material = lab.reference_materials as unknown as { title: string; version: string } | null;
  const btn = "rounded-lg px-4 py-2 text-sm font-medium";

  return (
    <section>
      <p className="mb-1 text-sm"><Link className="text-brand-700 hover:underline" href={`/laboratorios/${id}`}>← {lab.name}</Link></p>
      <h1 className="mb-1 text-2xl font-semibold">Rúbrica del laboratorio</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-600">
        La IA propone la estructura a partir de tu documento; tú la revisas y corriges. Solo una rúbrica confirmada (pesos = 100 %) se
        usará para evaluar.
      </p>
      <Notice error={error} ok={ok} />

      <details className="mb-6 max-w-3xl rounded-xl bg-white p-4 text-sm text-slate-700 ring-1 ring-slate-200" open={selected?.status === "borrador" && criteria.some((c) => c.levels.length < 2)}>
        <summary className="cursor-pointer font-medium text-slate-900">¿Qué son los niveles de desempeño y por qué importan?</summary>
        <div className="mt-3 space-y-2">
          <p>
            Cada criterio de la rúbrica describe qué se espera del trabajo en varios <b>niveles</b>, por ejemplo «Excelente», «Bueno», «Aceptable» e «Insuficiente». Cada nivel tiene un
            descriptor: la descripción de cómo se ve un trabajo en ese escalón.
          </p>
          <p>
            <b>La nota no se calcula con los niveles</b>: el sistema la calcula con los pesos (peso × porcentaje de cada criterio, sumados). Pero el <b>porcentaje de cada criterio</b> lo estima la IA
            comparando tus evidencias con los descriptores de los niveles: elige el nivel que mejor coincide y un porcentaje dentro de su rango. Por eso los niveles influyen en la nota de forma indirecta.
          </p>
          <p>
            Si un criterio tiene <b>menos de 2 niveles</b>, la IA no tiene una escala con la cual comparar y su estimación se vuelve más arbitraria (tiende a los extremos). La plataforma te avisa, pero no te lo impide.
            Para mejorar la precisión, agrega niveles en el borrador antes de confirmar la rúbrica (al menos dos por criterio, con un descriptor claro cada uno).
          </p>
        </div>
      </details>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form action={parseRubric}>
          <input type="hidden" name="labId" value={id} />
          <PendingButton
            className={`${btn} bg-pink-700 text-white hover:bg-pink-800`}
            pendingText="La IA está leyendo tu rúbrica…"
            hint="suele tardar entre 5 y 30 segundos"
            disabled={!lab.rubric_material_id}
            title={lab.rubric_material_id ? "" : "Asocia primero un documento de rúbrica al laboratorio"}
          >
            Interpretar con IA el documento asociado
          </PendingButton>
        </form>
        <form action={createBlankRubric}>
          <input type="hidden" name="labId" value={id} />
          <button className={`${btn} border border-slate-300 bg-white text-slate-700 hover:border-brand-400`}>Crear en blanco</button>
        </form>
      </div>
      <p className="mb-6 text-xs text-slate-500">
        {material ? `Documento asociado: ${material.title} (v${material.version}). La interpretación suele tardar entre 5 y 30 segundos.` : "Este laboratorio no tiene un documento de rúbrica asociado; puedes crearla en blanco."}
      </p>

      {rubrics && rubrics.length > 0 && (
        <nav className="mb-4 flex flex-wrap gap-2" aria-label="Versiones">
          {rubrics.map((r) => (
            <Link
              key={r.id}
              href={`/laboratorios/${id}/rubrica?v=${r.version}`}
              className={`rounded-full px-3 py-1 text-sm ring-1 ${r.id === selected?.id ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300"}`}
            >
              Versión {r.version} · {r.status === "confirmada" ? "confirmada" : "borrador"}
            </Link>
          ))}
        </nav>
      )}

      {!selected ? (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">Todavía no hay una rúbrica parametrizada para este laboratorio.</p>
      ) : selected.status === "borrador" ? (
        <div>
          <p className="mb-3 text-xs text-slate-500">
            Borrador · escala 0 a {selected.scale_max}
            {selected.parsed_by && ` · propuesta por ${selected.parsed_by}`}
          </p>
          <RubricEditor key={selected.id} rubricId={selected.id} initialTitle={selected.title} scale={selected.scale_max === 100 ? 100 : 5} initialCriteria={criteria} />
          <form action={deleteDraftRubric} className="mt-6">
            <input type="hidden" name="rubricId" value={selected.id} />
            <button className="text-sm text-red-600 hover:underline">Eliminar este borrador</button>
          </form>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-emerald-700">
            Confirmada el {selected.confirmed_at ? new Date(selected.confirmed_at).toLocaleString("es") : ""} · escala 0 a {selected.scale_max}. No se puede editar.
          </p>
          <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr><th className="px-3 py-2">Criterio</th><th className="px-3 py-2">Competencia</th><th className="px-3 py-2">Peso</th><th className="px-3 py-2">Niveles</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {criteria.map((c, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium">{c.criterion}</td>
                    <td className="px-3 py-2">{c.competency || "—"}</td>
                    <td className="px-3 py-2">{c.weight} %</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.levels.map((l) => `${l.name}${l.min_percent != null ? ` (≥${l.min_percent}%)` : ""}`).join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={newRubricVersion} className="mt-4">
            <input type="hidden" name="rubricId" value={selected.id} />
            <button className={`${btn} border border-slate-300 bg-white text-slate-700 hover:border-brand-400`}>Crear nueva versión para editar</button>
          </form>
        </div>
      )}
    </section>
  );
}
