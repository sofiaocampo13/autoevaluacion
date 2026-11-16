import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";
import { LabForm } from "../lab-form";
import { LabStages } from "../lab-stages";
import { createLab } from "../actions";

export const maxDuration = 300; // rellenar con IA lee la guía y puede tardar si el modelo está saturado

export default async function NewLabPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: mats } = await supabase
    .from("reference_materials")
    .select("id, title, version, category")
    .in("category", ["guia", "rubrica"]);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <Link href="/laboratorios" className="text-[14px] font-bold text-brand-700 hover:underline">← Mis laboratorios</Link>
        <h1 className="text-[32px] leading-tight tracking-[-0.02em] sm:text-[44px]">Cargar nuevo laboratorio</h1>
        <p className="text-[14px] text-slate-600">Primero guardas los datos del laboratorio; luego subes tu trabajo y lo evalúas desde su página.</p>
      </header>
      <Notice error={error} />
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[3_1_520px]">
          <LabForm
            action={createLab}
            guides={(mats ?? []).filter((m) => m.category === "guia")}
            rubrics={(mats ?? []).filter((m) => m.category === "rubrica")}
            submitLabel="Crear laboratorio"
          />
        </div>
        <aside className="min-w-0 flex-[1_1_300px]">
          <LabStages />
        </aside>
      </div>
    </section>
  );
}
