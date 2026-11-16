import { BrandMark } from "@/components/icons";
import { AuthTabs } from "@/components/auth-tabs";

const POINTS = [
  { dot: "bg-blue-300", text: "Cada valoración cita el archivo y el fragmento donde está la evidencia" },
  { dot: "bg-lavanda", text: "Tu espacio es privado: nadie más ve tus documentos" },
  { dot: "bg-pink-300", text: "Notas orientativas, nunca oficiales" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-wrap bg-slate-50 text-slate-800">
      <section className="flex flex-[1_1_480px] flex-col justify-between gap-12 bg-slate-900 p-[clamp(32px,5vw,72px)] text-[#F4EEFF]">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10" />
          <span className="font-display text-2xl font-semibold">Asesor pedagógico</span>
        </div>
        <div className="flex max-w-[520px] flex-col gap-5">
          <h1 className="font-display text-[clamp(38px,4vw,56px)] font-medium leading-[1.05] tracking-[-0.02em]">
            Descubre qué <em className="text-pink-300">dominas</em> y qué te falta, laboratorio por laboratorio.
          </h1>
          <p className="text-base leading-relaxed text-[#DCD3EE]">
            Sube tus trabajos del semestre y recibe una autoevaluación con evidencias, basada en la guía y la rúbrica de cada laboratorio.
          </p>
          <ul className="mt-2 flex flex-col gap-3 text-sm">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3">
                <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.dot}`} />
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-[#A99CC4]">Hecho por ingenieras para estudiantes.</p>
      </section>

      <section className="flex flex-[1_1_420px] items-center justify-center p-[clamp(24px,5vw,64px)]">
        <div className="w-full max-w-[440px] rounded-[28px] border border-slate-200 bg-white px-[clamp(22px,3vw,40px)] py-9">
          <AuthTabs />
          {children}
        </div>
      </section>
    </main>
  );
}
