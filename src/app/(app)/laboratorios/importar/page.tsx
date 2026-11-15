import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: labs } = await supabase.from("labs").select("name, cut");
  return (
    <section>
      <p className="mb-1 text-sm"><Link className="text-indigo-700 hover:underline" href="/laboratorios">← Mis laboratorios</Link></p>
      <h1 className="mb-1 text-2xl font-semibold">Importar carpeta del semestre</h1>
      <p className="mb-6 max-w-2xl text-slate-600">
        Elige la carpeta con tus trabajos. Se detecta un <b>corte</b> por cada carpeta &quot;Corte N&quot; y un{" "}
        <b>laboratorio</b> por cada subcarpeta que contiene. Verás una vista previa antes de crear nada.
      </p>
      <ImportClient existing={labs ?? []} />
    </section>
  );
}
