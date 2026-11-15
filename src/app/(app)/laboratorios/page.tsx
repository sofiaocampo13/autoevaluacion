import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";
import { cutLabel } from "@/lib/files";

export default async function LabsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const supabase = await createClient();
  const { data: labs } = await supabase
    .from("labs")
    .select("id, name, number, cut, description, lab_files(count)")
    .order("number", { nullsFirst: false })
    .order("created_at");

  // Agrupa por corte (los sin corte al final).
  const groups = new Map<number | null, NonNullable<typeof labs>>();
  for (const l of labs ?? []) groups.set(l.cut, [...(groups.get(l.cut) ?? []), l]);
  const keys = [...groups.keys()].sort((a, b) => (a ?? 99) - (b ?? 99));

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Mis laboratorios</h1>
        <div className="flex gap-2">
          <Link href="/laboratorios/importar" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-indigo-400">
            Importar carpeta del semestre
          </Link>
          <Link href="/laboratorios/nuevo" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Nuevo laboratorio
          </Link>
        </div>
      </div>
      <Notice ok={ok} />
      {keys.length === 0 ? (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Aún no tienes laboratorios. Crea el primero para subir tu trabajo.
        </p>
      ) : (
        keys.map((k) => (
          <div key={k ?? "none"} className="mb-6">
            <h2 className="mb-2 font-medium text-slate-800">{cutLabel(k)}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.get(k)!.map((l) => (
                <li key={l.id}>
                  <Link href={`/laboratorios/${l.id}`} className="block rounded-xl bg-white p-4 ring-1 ring-slate-200 hover:ring-indigo-300">
                    <p className="text-xs text-slate-500">{l.number != null ? `Laboratorio ${l.number}` : "Sin número"}</p>
                    <p className="font-medium text-slate-900">{l.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{l.description || "Sin descripción"}</p>
                    <p className="mt-2 text-xs text-slate-400">{l.lab_files?.[0]?.count ?? 0} archivo(s) · sin evaluar</p>
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
