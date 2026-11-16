import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { cutLabel } from "@/lib/files";
import { loadSemesterStats } from "@/lib/semester-data";

export default async function LabsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const supabase = await createClient();
  const { data: labs } = await supabase
    .from("labs")
    .select("id, name, number, cut, description, lab_files(count)")
    .order("number", { nullsFirst: false })
    .order("created_at");

  // Estado real de cada laboratorio (la última evaluación completada); antes decía «sin evaluar» aunque ya lo estuviera.
  const { data: subject } = await supabase.from("subjects").select("id, grade_scale_max").order("created_at").limit(1).maybeSingle();
  const stats = subject ? await loadSemesterStats(supabase, subject.id, Number(subject.grade_scale_max)) : null;
  const byLab = new Map((stats?.points ?? []).map((p) => [p.labId, p]));

  // Agrupa por corte (los sin corte al final).
  const groups = new Map<number | null, NonNullable<typeof labs>>();
  for (const l of labs ?? []) groups.set(l.cut, [...(groups.get(l.cut) ?? []), l]);
  const keys = [...groups.keys()].sort((a, b) => (a ?? 99) - (b ?? 99));

  return (
    <section>
      <PageHeader
        title="Mis laboratorios"
        description={`${labs?.length ?? 0} registrado(s) · ${byLab.size} evaluado(s)`}
        actions={
          <>
            <Link href="/laboratorios/importar" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-400">
              Importar carpeta del semestre
            </Link>
            <Link href="/laboratorios/nuevo" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Nuevo laboratorio
            </Link>
          </>
        }
      />
      <Notice ok={ok} />
      {keys.length === 0 ? (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Aún no tienes laboratorios. Crea el primero para subir tu trabajo.
        </p>
      ) : (
        keys.map((k) => (
          <div key={k ?? "none"} className="mb-8">
            <h2 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-slate-900">
              {cutLabel(k)}
              <span className="text-sm font-normal text-slate-500">{groups.get(k)!.length} laboratorio(s)</span>
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.get(k)!.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/laboratorios/${l.id}`}
                    className="flex h-full flex-col rounded-xl bg-white p-5 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(42,35,64,0.05)] transition-shadow hover:ring-brand-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium text-slate-500">{l.number != null ? `Laboratorio ${l.number}` : "Sin número"}</p>
                      {byLab.get(l.id) ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                          Evaluado · {byLab.get(l.id)!.percent} %
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">Sin evaluar</span>
                      )}
                    </div>
                    <p className="mt-2 font-semibold leading-snug text-slate-900">{l.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{l.description || "Sin descripción"}</p>
                    <p className="mt-auto pt-4 text-xs text-slate-500">{l.lab_files?.[0]?.count ?? 0} archivo(s)</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
