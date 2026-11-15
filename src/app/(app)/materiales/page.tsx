import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABELS, formatSize, extOf } from "@/lib/files";
import { UploadMaterialForm } from "./upload-material-form";
import { deleteMaterial } from "./actions";

export default async function MaterialsPage() {
  const supabase = await createClient();
  const [{ data: materials }, { data: labs }] = await Promise.all([
    supabase.from("reference_materials").select("*, labs!reference_materials_lab_fk(name)").order("created_at", { ascending: false }),
    supabase.from("labs").select("id, name").order("number", { nullsFirst: false }),
  ]);

  const preloaded = (materials ?? []).filter((m) => m.user_id === null);
  const mine = (materials ?? []).filter((m) => m.user_id !== null);

  return (
    <section>
      <h1 className="mb-1 text-2xl font-semibold">Materiales de referencia</h1>
      <p className="mb-6 max-w-2xl text-slate-600">
        Guías, rúbricas, mapas mentales y material de estudio que la IA usará como base para evaluar tus laboratorios.
        Si subes varias versiones de una guía o rúbrica, en cada laboratorio eliges cuál se aplica.
      </p>

      <UploadMaterialForm labs={labs ?? []} />

      {preloaded.length > 0 && (
        <p className="mb-6 text-sm text-slate-500">Hay {preloaded.length} material(es) precargado(s) disponibles.</p>
      )}

      {mine.length === 0 ? (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Aún no has agregado materiales. No hay materiales precargados para tu asignatura por ahora.
        </p>
      ) : (
        CATEGORIES.map((cat) => {
          const items = mine.filter((m) => m.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-6">
              <h2 className="mb-2 font-medium text-slate-800">{CATEGORY_LABELS[cat]}</h2>
              <ul className="divide-y divide-slate-200 rounded-xl bg-white ring-1 ring-slate-200">
                {items.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">
                        {m.title} <span className="font-normal text-slate-500">· versión {m.version}</span>
                      </p>
                      <p className="text-slate-500">
                        .{extOf(m.storage_path ?? "")} · {formatSize(m.size_bytes ?? 0)}
                        {m.labs?.name && ` · ${m.labs.name}`}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <a
                        className="text-indigo-700 hover:underline"
                        href={`/descargar?path=${encodeURIComponent(m.storage_path ?? "")}&name=${encodeURIComponent(`${m.title}.${extOf(m.storage_path ?? "")}`)}`}
                      >
                        Descargar
                      </a>
                      <form action={deleteMaterial}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="text-red-600 hover:underline" type="submit">Eliminar</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
