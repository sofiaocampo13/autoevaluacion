import { BrandMark, Icon } from "@/components/icons";

const POINTS = [
  "Cada valoración cita evidencias que el sistema verifica en tus archivos.",
  "La nota la calcula el sistema con los pesos de la rúbrica, no el modelo de IA.",
  "Es siempre una estimación orientativa y un docente puede revisarla.",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <section className="hidden flex-col justify-between bg-slate-800 px-12 py-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10" />
          <p className="font-display text-lg font-semibold">Asesor pedagógico</p>
        </div>
        <div>
          <h2 className="max-w-md font-display text-3xl font-semibold leading-tight tracking-tight">Autoevalúa tus laboratorios con apoyo de inteligencia artificial.</h2>
          <ul className="mt-8 max-w-md space-y-4 text-slate-300">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3">
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-pink-300" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-slate-300">Proyecto académico · Ingeniería de Sistemas, Universidad de Manizales</p>
      </section>

      <section className="flex items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <p className="font-display font-semibold text-slate-900">Asesor pedagógico</p>
          </div>
          <div className="rounded-2xl bg-white p-8 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(42,35,64,0.05)]">{children}</div>
        </div>
      </section>
    </main>
  );
}
