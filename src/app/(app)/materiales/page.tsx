import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABELS, formatSize, extOf, type Category } from "@/lib/files";
import { Icon } from "@/components/icons";
import { UploadMaterialForm } from "./upload-material-form";
import { deleteMaterial } from "./actions";

// Colores de la etiqueta de categoría (mockups/materiales.html).
const CATEGORY_CHIP: Record<Category, string> = {
  guia: "bg-[#E6EEFF] text-[#1E44A8]",
  rubrica: "bg-[#EFE8FF] text-[#4C24A8]",
  mapa_mental: "bg-[#FCE7F1] text-[#9A1F55]",
  material_estudio: "bg-[#F1ECF8] text-[#4A4260]",
  complementario: "bg-[#F1ECF8] text-[#4A4260]",
};

const tab = "inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] px-[18px] text-sm font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2";
const tabOn = "border-slate-800 bg-slate-800 text-white";
const tabOff = "border-[#E3DBF0] bg-white text-[#4A4260] hover:border-brand-400";
const cols = "md:grid-cols-[2.2fr_1.3fr_1.1fr_1.1fr_0.8fr_1.2fr]";

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const active = CATEGORIES.find((c) => c === cat) ?? null;

  const supabase = await createClient();
  const [{ data: materials }, { data: labs }, { data: rubrics }] = await Promise.all([
    supabase.from("reference_materials").select("*, labs!reference_materials_lab_fk(name)").order("created_at", { ascending: false }),
    supabase.from("labs").select("id, name, number").order("number", { nullsFirst: false }),
    supabase.from("rubrics").select("lab_id").eq("status", "confirmada"),
  ]);

  const all = materials ?? [];
  const preloadedCount = all.filter((m) => m.user_id === null).length;
  const mineCount = all.length - preloadedCount;
  const withRubric = new Set((rubrics ?? []).map((r) => r.lab_id));
  const labsWithoutRubric = (labs ?? []).filter((l) => !withRubric.has(l.id));
  const shown = active ? all.filter((m) => m.category === active) : all;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-[18px]">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-pink-600">Base de conocimiento de la asignatura</span>
          <h1 className="text-[32px] leading-tight tracking-[-0.02em] sm:text-[44px]">Materiales de referencia</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Guías, rúbricas, mapas mentales y material de estudio que la IA usará como base para evaluar tus laboratorios.
            Si subes varias versiones de una guía o rúbrica, en cada laboratorio eliges cuál se aplica.
          </p>
        </div>
        <a
          href="#agregar"
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-600 px-[22px] text-sm font-extrabold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
        >
          <Icon name="mas" className="h-[18px] w-[18px]" />
          Agregar material
        </a>
      </header>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <div className="flex items-center gap-3.5 rounded-[18px] border border-slate-200 bg-white px-[18px] py-4">
          <span className="font-display text-[34px] text-blue-600">{preloadedCount}</span>
          <span className="text-[13px] font-bold text-slate-600">Precargados en la plataforma</span>
        </div>
        <div className="flex items-center gap-3.5 rounded-[18px] border border-slate-200 bg-white px-[18px] py-4">
          <span className="font-display text-[34px] text-pink-600">{mineCount}</span>
          <span className="text-[13px] font-bold text-slate-600">Agregados por mí</span>
        </div>
        {labsWithoutRubric.length > 0 && (
          <div className="flex items-center gap-3.5 rounded-[18px] bg-aviso-bg px-[18px] py-4">
            <span className="font-display text-[34px] text-aviso-text">{labsWithoutRubric.length}</span>
            <span className="text-[13px] font-bold text-aviso-text">
              {labsWithoutRubric.length === 1 ? "Laboratorio sin rúbrica" : "Laboratorios sin rúbrica"}
              {labsWithoutRubric.length <= 3 && ` (${labsWithoutRubric.map((l) => (l.number != null ? `Lab ${l.number}` : l.name)).join(", ")})`}
            </span>
          </div>
        )}
      </div>

      <nav aria-label="Categorías" className="flex flex-wrap gap-2">
        <Link href="/materiales" aria-current={active === null ? "page" : undefined} className={`${tab} ${active === null ? tabOn : tabOff}`}>
          Todos <span className="opacity-70">{all.length}</span>
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={`/materiales?cat=${c}`} aria-current={active === c ? "page" : undefined} className={`${tab} ${active === c ? tabOn : tabOff}`}>
            {CATEGORY_LABELS[c]} <span className="opacity-70">{all.filter((m) => m.category === c).length}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-slate-700">
          {all.length === 0
            ? "Aún no has agregado materiales. No hay materiales precargados para tu asignatura por ahora."
            : "No hay materiales en esta categoría."}
        </p>
      ) : (
        <section className="rounded-[24px] border border-slate-200 bg-white px-[18px] pb-3.5 pt-2">
          <div className={`hidden gap-x-3 px-2 py-3.5 text-xs font-bold text-slate-500 md:grid ${cols}`}>
            <span>Documento</span><span>Categoría</span><span>Origen</span><span>Asociado a</span><span>Versión</span><span>Acciones</span>
          </div>
          <ul>
            {shown.map((m) => {
              const own = m.user_id !== null;
              const ext = extOf(m.storage_path ?? "");
              return (
                <li key={m.id} className={`grid grid-cols-1 items-center gap-x-3 gap-y-2 border-t border-[#F1ECF8] px-2 py-3.5 text-[13.5px] ${cols}`}>
                  <div className="min-w-0">
                    <p className="break-words font-bold">{m.title}</p>
                    <p className="text-xs text-slate-500">{ext && `.${ext} · `}{formatSize(m.size_bytes ?? 0)}</p>
                  </div>
                  <div>
                    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${CATEGORY_CHIP[m.category as Category]}`}>
                      {CATEGORY_LABELS[m.category as Category]}
                    </span>
                  </div>
                  <span className="text-slate-600">{own ? "Agregado por mí" : "Precargado"}</span>
                  <span className="text-slate-600">{m.labs?.name ?? "Toda la asignatura"}</span>
                  <div>
                    <span className="inline-block whitespace-nowrap rounded-lg bg-[#F7F3FC] px-2 py-[3px] text-xs font-bold text-[#4A4260]">v{m.version}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {own ? (
                      <>
                        <a
                          className="inline-flex min-h-11 items-center font-bold text-brand-600 underline hover:text-brand-700"
                          href={`/descargar?path=${encodeURIComponent(m.storage_path ?? "")}&name=${encodeURIComponent(`${m.title}.${ext}`)}`}
                        >
                          Descargar
                        </a>
                        <form action={deleteMaterial}>
                          <input type="hidden" name="id" value={m.id} />
                          <button className="inline-flex min-h-11 items-center font-bold text-pink-700 underline hover:text-pink-800" type="submit">
                            Eliminar
                          </button>
                        </form>
                      </>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <UploadMaterialForm labs={labs ?? []} />
    </section>
  );
}
