import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Notice, Note } from "@/components/ui";
import { Icon } from "@/components/icons";
import { cutLabel } from "@/lib/files";
import { loadSemesterStats } from "@/lib/semester-data";
import { GRADE_DISCLAIMER } from "@/lib/scoring";

type Estado = "todos" | "evaluados" | "pendientes";

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export default async function LabsPage({ searchParams }: { searchParams: Promise<{ ok?: string; estado?: string }> }) {
  const { ok, estado: rawEstado } = await searchParams;
  const estado: Estado = rawEstado === "evaluados" || rawEstado === "pendientes" ? rawEstado : "todos";
  const supabase = await createClient();
  const [{ data: labs }, { data: confirmed }] = await Promise.all([
    supabase.from("labs").select("id, name, number, cut, description, lab_files(count)").order("number", { nullsFirst: false }).order("created_at"),
    supabase.from("rubrics").select("lab_id").eq("status", "confirmada"),
  ]);
  const withRubric = new Set((confirmed ?? []).map((r) => r.lab_id));

  // Estado real de cada laboratorio (la última evaluación completada); antes decía «sin evaluar» aunque ya lo estuviera.
  const { data: subject } = await supabase.from("subjects").select("id, grade_scale_max").order("created_at").limit(1).maybeSingle();
  const scaleMax = subject ? Number(subject.grade_scale_max) : null;
  const stats = subject && scaleMax != null ? await loadSemesterStats(supabase, subject.id, scaleMax) : null;
  const byLab = new Map((stats?.points ?? []).map((p) => [p.labId, p]));

  const all = labs ?? [];
  const counts = { todos: all.length, evaluados: all.filter((l) => byLab.has(l.id)).length, pendientes: all.filter((l) => !byLab.has(l.id)).length };
  const shown = all.filter((l) => estado === "todos" || (estado === "evaluados") === byLab.has(l.id));

  // Agrupa por corte (los sin corte al final).
  const groups = new Map<number | null, typeof shown>();
  for (const l of shown) groups.set(l.cut, [...(groups.get(l.cut) ?? []), l]);
  const keys = [...groups.keys()].sort((a, b) => (a ?? 99) - (b ?? 99));

  const filters: { key: Estado; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "evaluados", label: "Evaluados" },
    { key: "pendientes", label: "Pendientes" },
  ];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="min-w-0">
          <h1 className="text-[32px] leading-tight tracking-[-0.02em] sm:text-[44px]">Mis laboratorios</h1>
          <p className="mt-1.5 text-[14px] text-slate-600">
            {all.length} registrado(s) · {counts.evaluados} evaluado(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/laboratorios/importar"
            className="inline-flex min-h-12 items-center rounded-full border-[1.5px] border-brand-600 bg-white px-5 text-[14px] font-extrabold text-brand-700 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            Importar carpeta del semestre
          </Link>
          <Link
            href="/laboratorios/nuevo"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-600 px-[22px] text-[14px] font-extrabold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
          >
            <Icon name="mas" className="h-[18px] w-[18px]" />
            Nuevo laboratorio
          </Link>
        </div>
      </header>

      <Notice ok={ok} />

      {all.length > 0 && (
        <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2.5">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={f.key === "todos" ? "/laboratorios" : `/laboratorios?estado=${f.key}`}
              aria-current={estado === f.key ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border-[1.5px] px-[18px] text-[14px] font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
                estado === f.key ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {f.label} <span className="ml-1 opacity-75">· {counts[f.key]}</span>
            </Link>
          ))}
        </nav>
      )}

      {all.length === 0 ? (
        <p className="rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-[14px] text-slate-600">
          Aún no tienes laboratorios. Crea el primero para subir tu trabajo.
        </p>
      ) : keys.length === 0 ? (
        <p className="rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-[14px] text-slate-600">No hay laboratorios en este filtro.</p>
      ) : (
        keys.map((k) => (
          <div key={k ?? "none"}>
            <h2 className="mb-3.5 flex items-baseline gap-2 text-[22px]">
              {cutLabel(k)}
              <span className="font-sans text-[13px] font-normal text-slate-600">{groups.get(k)!.length} laboratorio(s)</span>
            </h2>
            <ul className="grid gap-[18px] sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
              {groups.get(k)!.map((l) => {
                const p = byLab.get(l.id);
                const files = l.lab_files?.[0]?.count ?? 0;
                return (
                  <li key={l.id}>
                    <article className="flex h-full flex-col gap-3.5 rounded-3xl border border-slate-200 bg-white p-[22px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-extrabold tracking-[0.06em] text-slate-500 uppercase">
                          {l.number != null ? `Lab ${l.number}` : "Sin número"}
                        </span>
                        {p ? (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-extrabold text-blue-800">Evaluado</span>
                        ) : (
                          <span className="rounded-full bg-pink-50 px-2.5 py-1 text-[12px] font-extrabold text-pink-700">Sin evaluar</span>
                        )}
                      </div>
                      <h3 className="text-[23px] leading-[1.2]">{l.name}</h3>
                      <p className="line-clamp-2 text-[13px] leading-normal text-slate-600">{l.description || "Sin descripción"}</p>
                      <div className="flex flex-wrap gap-1.5 text-[12px]">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-800">{files === 0 ? "Sin archivos" : `${files} archivo(s)`}</span>
                        {withRubric.has(l.id) ? (
                          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-800">Rúbrica confirmada</span>
                        ) : (
                          <span className="rounded-full bg-aviso-bg px-2.5 py-1 text-aviso-text">Sin rúbrica confirmada</span>
                        )}
                      </div>
                      {p && scaleMax != null && (
                        <div className="flex items-center gap-3">
                          <div
                            className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
                            role="img"
                            aria-label={`Cumplimiento ${p.percent} %`}
                          >
                            <div className="h-full bg-brand-600" style={{ width: `${Math.min(100, Math.max(0, p.percent))}%` }} />
                          </div>
                          <span className="text-[14px] font-extrabold">{fmt(p.percent)} %</span>
                          <span className="text-[14px] font-extrabold text-pink-800">
                            {fmt(p.grade)} / {fmt(scaleMax)}
                          </span>
                        </div>
                      )}
                      <Link
                        href={`/laboratorios/${l.id}`}
                        className={`mt-auto flex min-h-[46px] items-center justify-center rounded-full text-[13px] font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 ${
                          p ? "border-[1.5px] border-brand-600 bg-white text-brand-700 hover:bg-brand-50" : "bg-pink-700 tracking-[0.03em] text-white hover:bg-pink-800"
                        }`}
                      >
                        {p ? "Ver laboratorio" : "Abrir y evaluar"}
                      </Link>
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      {byLab.size > 0 && <Note>{GRADE_DISCLAIMER}</Note>}
    </section>
  );
}
