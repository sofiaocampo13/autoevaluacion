import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AI_COST } from "@/lib/ai-budget";
import { Notice } from "@/components/ui";
import { Icon } from "@/components/icons";
import { PendingButton } from "@/components/pending-button";
import type { Criterion } from "@/lib/rubric-validate";
import { RubricEditor } from "./rubric-editor";
import { createBlankRubric, deleteDraftRubric, newRubricVersion, parseRubric } from "./actions";

export const maxDuration = 300; // la interpretación con IA puede tardar más de un minuto si el modelo está saturado

const pill = "inline-flex min-h-12 items-center justify-center rounded-full px-[22px] text-sm font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2";
const pillOutline = `${pill} border-[1.5px] border-brand-600 bg-white text-brand-600 hover:bg-brand-50`;

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
  const totalWeight = Math.round(criteria.reduce((s, c) => s + (c.weight ?? 0), 0) * 100) / 100;
  const cost = AI_COST.rubrica;

  return (
    <section className="flex flex-col gap-[22px]">
      <header className="flex flex-col gap-2">
        <Link className="inline-flex min-h-11 w-fit items-center text-sm font-bold text-brand-600 hover:text-brand-800 hover:underline" href={`/laboratorios/${id}`}>
          ← {lab.name}
        </Link>
        <h1 className="text-[32px] tracking-[-0.02em] md:text-[44px]">Rúbrica del laboratorio</h1>
        <p className="max-w-[70ch] text-[15px] leading-[1.55] text-slate-600">
          La IA propone la estructura a partir de tu documento; tú la revisas y corriges. Solo una rúbrica confirmada (pesos = 100 %) se
          usará para evaluar.
        </p>
      </header>
      <Notice error={error} ok={ok} />

      <details
        className="max-w-[900px] rounded-[20px] border border-slate-200 bg-white px-5 py-4"
        open={selected?.status === "borrador" && criteria.some((c) => c.levels.length < 2)}
      >
        <summary className="min-h-7 cursor-pointer text-[15px] font-extrabold">¿Qué son los niveles de desempeño y por qué importan?</summary>
        <div className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-slate-600">
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

      <div className="flex flex-wrap items-start gap-3.5">
        <div className="flex flex-col gap-2">
          <form action={parseRubric}>
            <input type="hidden" name="labId" value={id} />
            <PendingButton
              className={`${pill} gap-2 bg-pink-700 text-white hover:bg-pink-800`}
              pendingText="La IA está leyendo tu rúbrica…"
              hint="suele tardar entre 5 y 60 segundos"
              disabled={!lab.rubric_material_id}
              title={lab.rubric_material_id ? "" : "Asocia primero un documento de rúbrica al laboratorio"}
            >
              <Icon name="infografia" className="h-[18px] w-[18px]" />
              Interpretar con IA el documento asociado
            </PendingButton>
          </form>
          <span className="w-fit rounded-full bg-aviso-bg px-3 py-1 text-xs font-bold text-aviso-text">
            Gasta {cost} {cost === 1 ? "unidad" : "unidades"} de IA · tarda de 5 a 60 s
          </span>
        </div>
        <form action={createBlankRubric}>
          <input type="hidden" name="labId" value={id} />
          <button className={pillOutline}>Crear en blanco</button>
        </form>
        <p className="min-w-[260px] flex-1 self-center text-[13px] text-slate-600">
          {material ? `Documento asociado: ${material.title} (v${material.version}).` : "Este laboratorio no tiene un documento de rúbrica asociado; puedes crearla en blanco."}
        </p>
      </div>

      {rubrics && rubrics.length > 0 && (
        <nav className="flex flex-wrap gap-2" aria-label="Versiones">
          {rubrics.map((r) => (
            <Link
              key={r.id}
              href={`/laboratorios/${id}/rubrica?v=${r.version}`}
              aria-current={r.id === selected?.id ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border-[1.5px] px-[18px] text-sm font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
                r.id === selected?.id ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
              }`}
            >
              Versión {r.version} · {r.status === "confirmada" ? "confirmada" : "borrador"}
            </Link>
          ))}
        </nav>
      )}

      {!selected ? (
        <p className="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Todavía no hay una rúbrica parametrizada para este laboratorio.</p>
      ) : selected.status === "borrador" ? (
        <div>
          <p className="mb-4 text-[13px] text-slate-600">
            Borrador · escala 0 a {selected.scale_max}
            {selected.parsed_by && ` · propuesta por ${selected.parsed_by}`}
          </p>
          <RubricEditor key={selected.id} rubricId={selected.id} initialTitle={selected.title} scale={selected.scale_max === 100 ? 100 : 5} initialCriteria={criteria}>
            <form action={deleteDraftRubric}>
              <input type="hidden" name="rubricId" value={selected.id} />
              <ConfirmButton label="Eliminar este borrador" question="¿Eliminar este borrador de rúbrica? Se pierden los criterios que no hayas confirmado." confirmLabel="Sí, eliminar borrador" className="min-h-11 text-sm font-bold text-[#B4233A] hover:underline" />
            </form>
          </RubricEditor>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="flex w-fit max-w-full items-center gap-2 rounded-[14px] bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span>
              Confirmada el {selected.confirmed_at ? new Date(selected.confirmed_at).toLocaleString("es") : ""} · escala 0 a {selected.scale_max}. No se puede editar.
            </span>
          </p>
          <div className="overflow-x-auto rounded-[22px] border border-slate-200 bg-white px-3 py-2">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[13px] text-slate-600">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-3 font-semibold">Criterio</th>
                  <th className="px-3 py-3 font-semibold">Competencia</th>
                  <th className="px-3 py-3 font-semibold">Peso</th>
                  <th className="px-3 py-3 font-semibold">Niveles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {criteria.map((c, i) => (
                  <tr key={i}>
                    <td className="px-3 py-3.5 font-bold text-slate-800">{c.criterion}</td>
                    <td className="px-3 py-3.5 text-slate-600">{c.competency || "—"}</td>
                    <td className="px-3 py-3.5 font-extrabold text-brand-800">{c.weight} %</td>
                    <td className="px-3 py-3.5 text-[13px] text-slate-600">{c.levels.map((l) => `${l.name}${l.min_percent != null ? ` (≥${l.min_percent}%)` : ""}`).join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-800">
                  <td className="px-3 py-3.5 font-extrabold text-slate-800">Total</td>
                  <td />
                  <td className="px-3 py-3.5 font-extrabold text-slate-800">{totalWeight} %</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <form action={newRubricVersion}>
            <input type="hidden" name="rubricId" value={selected.id} />
            <button className={pillOutline}>Crear nueva versión para editar</button>
          </form>
        </div>
      )}
    </section>
  );
}
