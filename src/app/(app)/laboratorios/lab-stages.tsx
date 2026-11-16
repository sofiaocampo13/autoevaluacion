// Etapas reales del proceso de evaluación (las mismas que muestra el panel de evaluación), explicadas antes de empezar.
const STAGES: { title: string; text: string; color: string }[] = [
  { title: "Confirmar la rúbrica", text: "La IA interpreta tu rúbrica; tú la corriges y la confirmas.", color: "bg-pink-200" },
  { title: "Subir tu trabajo", text: "Archivos sueltos o una carpeta completa, o un repositorio público.", color: "bg-lavanda" },
  { title: "Valorar los criterios", text: "Paso 1 de 2: la IA valora cada criterio con citas de tus archivos.", color: "bg-blue-300" },
  { title: "Calcular y redactar", text: "Paso 2 de 2: el sistema calcula la nota orientativa y se redacta la retroalimentación.", color: "bg-blue-200" },
];

export function LabStages() {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-3xl bg-slate-900 p-6 text-slate-50">
        <h2 className="text-[22px]">Así se evalúa tu trabajo</h2>
        <ol className="flex flex-col gap-3">
          {STAGES.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3">
              <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12px] font-extrabold text-slate-900 ${s.color}`}>{i + 1}</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-extrabold">{s.title}</span>
                <span className="text-[12px] leading-[1.45] text-slate-200">{s.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="rounded-[20px] border border-dashed border-slate-300 bg-white px-5 py-[18px]">
        <h3 className="font-sans text-[13px] font-extrabold">Antes de evaluar</h3>
        <p className="mt-1.5 text-[13px] leading-normal text-slate-600">
          La IA solo valora lo que encuentra en tus archivos: si algo no aparece, se marca como «sin evidencia», no como hecho. La nota es una
          estimación orientativa.
        </p>
      </section>
    </div>
  );
}
