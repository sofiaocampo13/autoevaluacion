import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";
import { LabForm } from "../lab-form";
import { createLab } from "../actions";

export default async function NewLabPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: mats } = await supabase
    .from("reference_materials")
    .select("id, title, version, category")
    .in("category", ["guia", "rubrica"]);

  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold">Nuevo laboratorio</h1>
      <Notice error={error} />
      <LabForm
        action={createLab}
        guides={(mats ?? []).filter((m) => m.category === "guia")}
        rubrics={(mats ?? []).filter((m) => m.category === "rubrica")}
        submitLabel="Crear laboratorio"
      />
    </section>
  );
}
