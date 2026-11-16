import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GRADE_DISCLAIMER } from "@/lib/scoring";
import { REVIEW_LABEL } from "@/lib/review-logic";
import { Note } from "@/components/ui";

type Row = {
  id: string;
  lab_id: string;
  completed_at: string | null;
  created_at: string;
  ai_model: string | null;
  rubric_version: number | null;
  has_rubric: boolean;
  overall_percent: number | null;
  estimated_grade: number | null;
  final_grade: number | null;
  final_percent: number | null;
  grade_scale_max: number;
  review_status: keyof typeof REVIEW_LABEL;
};

const link = "inline-flex min-h-11 items-center text-[13px] font-bold text-brand-600 underline hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300";
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const num = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ lab?: string }> }) {
  const { lab: labParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: subject }, { data: labs }, { data: evals }] = await Promise.all([
    supabase.from("subjects").select("name, academic_period").order("created_at").limit(1).maybeSingle(),
    supabase.from("labs").select("id, name, number").order("number", { nullsFirst: false }),
    supabase
      .from("evaluations")
      .select("id, lab_id, completed_at, created_at, ai_model, rubric_version, has_rubric, overall_percent, estimated_grade, final_grade, final_percent, grade_scale_max, review_status")
      .eq("status", "completada")
      .order("completed_at", { ascending: true }),
  ]);

  const labById = new Map((labs ?? []).map((l) => [l.id, l]));
  const rows = (evals ?? []) as Row[];
  const labFilter = labParam && labById.has(labParam) ? labParam : null;

  // Posición de cada evaluación dentro de su laboratorio (v1, v2…) y la anterior, para comparar sin inventar nada.
  const order = new Map<string, { n: number; prev: Row | null }>();
  const seen = new Map<string, Row[]>();
  for (const r of rows) {
    const list = seen.get(r.lab_id) ?? [];
    order.set(r.id, { n: list.length + 1, prev: list[list.length - 1] ?? null });
    seen.set(r.lab_id, [...list, r]);
  }

  const shown = rows.filter((r) => !labFilter || r.lab_id === labFilter).reverse();

  // Comparación criterio a criterio entre las dos últimas evaluaciones del laboratorio filtrado.
  const pair = labFilter ? (seen.get(labFilter) ?? []).slice(-2) : [];
  const { data: crit } =
    pair.length === 2
      ? await supabase.from("criterion_results").select("evaluation_id, criterion, percent, position").in("evaluation_id", pair.map((p) => p.id)).order("position")
      : { data: null };
  const comparison =
    pair.length === 2 && crit
      ? crit
          .filter((c) => c.evaluation_id === pair[1].id)
          .map((c) => {
            const before = crit.find((p) => p.evaluation_id === pair[0].id && p.criterion === c.criterion);
            return { criterion: c.criterion, now: Number(c.percent), before: before ? Number(before.percent) : null };
          })
      : [];

  const labName = (id: string) => {
    const l = labById.get(id);
    return l ? (l.number != null ? `Lab ${l.number} · ${l.name}` : l.name) : "Laboratorio";
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        {subject && (
          <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-pink-600">
            {subject.name}{subject.academic_period && ` · ${subject.academic_period}`}
          </span>
        )}
        <h1 className="text-[32px] leading-tight tracking-[-0.02em] sm:text-[44px]">Historial de evaluaciones</h1>
        <p className="text-sm text-slate-600">Cada evaluación queda ligada a los archivos y versiones de guía y rúbrica que se usaron.</p>
      </header>

      {(labs ?? []).length > 1 && rows.length > 0 && (
        <nav aria-label="Filtrar por laboratorio" className="flex flex-wrap gap-2">
          <Link
            href="/historial"
            aria-current={labFilter === null ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border-[1.5px] px-[18px] text-sm font-extrabold ${labFilter === null ? "border-slate-800 bg-slate-800 text-white" : "border-[#E3DBF0] bg-white text-[#4A4260] hover:border-brand-400"}`}
          >
            Todos
          </Link>
          {(labs ?? []).filter((l) => seen.has(l.id)).map((l) => (
            <Link
              key={l.id}
              href={`/historial?lab=${l.id}`}
              aria-current={labFilter === l.id ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border-[1.5px] px-[18px] text-sm font-extrabold ${labFilter === l.id ? "border-slate-800 bg-slate-800 text-white" : "border-[#E3DBF0] bg-white text-[#4A4260] hover:border-brand-400"}`}
            >
              {l.number != null ? `Lab ${l.number}` : l.name}
            </Link>
          ))}
        </nav>
      )}

      {shown.length === 0 ? (
        <p className="rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-slate-700">
          Aún no hay evaluaciones completadas. Evalúa un laboratorio en <Link className="font-bold text-brand-700 underline" href="/laboratorios">Mis laboratorios</Link> y aparecerá aquí.
        </p>
      ) : (
        <ol className="flex flex-col">
          {shown.map((e) => {
            const pos = order.get(e.id)!;
            const reviewed = e.review_status === "aprobada" || e.review_status === "ajustada";
            const grade = reviewed && e.final_grade != null ? e.final_grade : e.estimated_grade;
            const percent = reviewed && e.final_percent != null ? e.final_percent : e.overall_percent;
            const diff = pos.prev && percent != null && (pos.prev.overall_percent != null) ? Math.round((percent - Number(pos.prev.overall_percent)) * 10) / 10 : null;
            return (
              <li key={e.id} className="flex gap-[18px]">
                <div className="flex w-6 flex-none flex-col items-center" aria-hidden="true">
                  <span className={`mt-[22px] box-border h-4 w-4 flex-none rounded-full border-[3px] border-slate-50 ${pos.n > 1 ? "bg-pink-600 shadow-[0_0_0_2px_#C2306E]" : "bg-brand-600 shadow-[0_0_0_2px_#6D3FD9]"}`} />
                  <span className="w-0.5 flex-1 bg-[#E3DBF0]" />
                </div>
                <div className="mb-3.5 flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2.5 rounded-[18px] border border-slate-200 bg-white px-5 py-4">
                  <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-[3px]">
                    <span className="text-xs font-bold text-slate-500">{fmtDate(e.completed_at ?? e.created_at)}</span>
                    <span className="text-[15px] font-extrabold">{labName(e.lab_id)} (evaluación {pos.n} de tu trabajo)</span>
                    <span className="text-[12.5px] text-slate-600">
                      {e.ai_model ?? "Modelo no registrado"} · {e.has_rubric ? `Rúbrica v${e.rubric_version}` : "sin rúbrica formal"} · {REVIEW_LABEL[e.review_status]}
                    </span>
                  </div>
                  <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-extrabold ${pos.n > 1 ? "bg-pink-50 text-pink-700" : "bg-brand-50 text-brand-700"}`}>
                    {pos.n > 1 ? "Re-evaluación" : "Evaluación"}
                  </span>
                  <span className="min-w-[110px] text-right text-sm font-extrabold">
                    {percent != null ? `${num(Number(percent))} %` : "—"}
                    {grade != null && ` · ${num(Number(grade))} / ${e.grade_scale_max}`}
                    {diff != null && <span className="block text-xs font-bold text-slate-600">{diff > 0 ? "+" : ""}{num(diff)} pts vs. la anterior</span>}
                  </span>
                  <span className="flex flex-wrap gap-x-4">
                    <Link href={`/laboratorios/${e.lab_id}/evaluacion/${e.id}`} className={link}>Ver resultados</Link>
                    {pos.prev && labFilter !== e.lab_id && <Link href={`/historial?lab=${e.lab_id}#comparar`} className={link}>Comparar</Link>}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {comparison.length > 0 && (
        <section id="comparar" className="scroll-mt-8 rounded-[24px] border border-slate-200 bg-white p-6">
          <h2 className="mb-1 text-[22px]">Comparación por criterio</h2>
          <p className="mb-4 text-sm text-slate-600">
            {labName(labFilter!)}: evaluación {order.get(pair[0].id)!.n} frente a evaluación {order.get(pair[1].id)!.n}, con los porcentajes guardados.
          </p>
          <ul className="divide-y divide-[#F1ECF8] text-sm">
            {comparison.map((c) => {
              const d = c.before != null ? Math.round((c.now - c.before) * 10) / 10 : null;
              return (
                <li key={c.criterion} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="min-w-0 flex-[1_1_220px] font-bold">{c.criterion}</span>
                  <span className="text-slate-600">
                    {c.before != null ? `${num(c.before)} %` : "sin dato"} → <b className="text-slate-800">{num(c.now)} %</b>
                    {d != null && ` (${d > 0 ? "+" : ""}${num(d)} pts)`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {shown.length > 0 && <Note>{GRADE_DISCLAIMER}</Note>}
    </section>
  );
}
