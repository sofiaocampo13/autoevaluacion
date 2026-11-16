import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: labs } = await supabase.from("labs").select("name, cut");
  return (
    <section className="flex flex-col gap-4">
      <Link className="inline-flex min-h-11 w-fit items-center text-[14px] font-bold text-brand-700 hover:underline" href="/laboratorios">← Mis laboratorios</Link>
      <h1 className="text-[32px] leading-tight tracking-[-0.02em] sm:text-[44px]">Importar carpeta del semestre</h1>
      <p className="max-w-2xl text-[14px] leading-normal text-slate-600">
        Elige la carpeta con tus trabajos. Se detecta un <b>corte</b> por cada carpeta &quot;Corte N&quot; y un{" "}
        <b>laboratorio</b> por cada subcarpeta que contiene. Verás una vista previa antes de crear nada.
      </p>
      <ImportClient existing={labs ?? []} />
    </section>
  );
}
