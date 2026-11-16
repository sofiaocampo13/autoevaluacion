import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acerca del proyecto",
  description: "Plataforma web de autoevaluación académica con IA: objetivos, funcionalidades, tecnologías y equipo.",
};

// Las fotos están en public/equipo/. Si una integrante no tiene `photo`, se muestran sus iniciales.
// `ring` es el color del aro de la foto.
const TEAM: { name: string; role: string; photo?: string; ring: string }[] = [
  { name: "Sofía Ocampo Gómez", role: "Desarrollo", photo: "/equipo/sofia.jpg", ring: "ring-[#C2306E]" },
  { name: "Adriana Vargas Herrera", role: "Diseño", photo: "/equipo/adriana.jpg", ring: "ring-[#6D3FD9]" },
  { name: "Laura Rojas Castaño", role: "Análisis de requisitos y pruebas", photo: "/equipo/laura.jpg", ring: "ring-[#2E5BD8]" },
];

// Cada funcionalidad lleva el color de su círculo numerado.
const FEATURES: { text: string; bg: string }[] = [
  { text: "Carga de la descripción y los objetivos del laboratorio, su rúbrica y la solución del estudiante (documentos, código, carpetas, ZIP o repositorio de GitHub).", bg: "bg-[#F49AC1]" },
  { text: "Interpretación y parametrización de la rúbrica con revisión del estudiante: criterios, niveles de desempeño y ponderaciones que suman 100 %.", bg: "bg-[#E3A6F0]" },
  { text: "Evaluación de cada laboratorio con IA, con citas de fragmentos que el sistema verifica en los archivos; la nota orientativa la calcula el sistema, no el modelo.", bg: "bg-[#B9A2FF]" },
  { text: "Retroalimentación, recomendaciones e infografía por laboratorio, e informe PDF.", bg: "bg-[#A3AEFF]" },
  { text: "Revisión docente mediante un enlace seguro, de un solo uso: el docente ajusta criterios con justificación y el sistema recalcula la nota.", bg: "bg-[#8FB0FF]" },
  { text: "Informe integrado del semestre con evolución, brechas y plan personalizado de fortalecimiento, e infografía descargable.", bg: "bg-[#B9A2FF]" },
  { text: "Mapa mental interactivo con el nivel de dominio de cada tema, las evidencias y lo que conviene profundizar.", bg: "bg-[#F49AC1]" },
];

const TECH = ["Next.js y React", "TypeScript", "Tailwind CSS", "Supabase (PostgreSQL, autenticación y almacenamiento)", "Gemini (Google) como modelo de IA", "Vercel", "react-pdf"];

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

const card = "rounded-[28px] border border-slate-200 bg-white";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="bg-slate-900 px-[clamp(18px,5vw,72px)] pb-14 pt-10 text-white">
        <Link
          href="/"
          className="mb-5 inline-flex min-h-11 items-center text-sm font-bold text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
        >
          ← Volver a la plataforma
        </Link>
        <header className="flex max-w-[900px] flex-col gap-3">
          <p className="text-[13px] font-extrabold uppercase tracking-widest text-pink-300">Proyecto final · Profundización I · Inteligencia Artificial</p>
          <h1 className="text-[clamp(40px,5vw,64px)] leading-[1.02] tracking-tight">
            Asesor pedagógico <em className="text-pink-300">inteligente</em>
          </h1>
          <p className="text-[19px] leading-normal text-slate-200">Autoevaluación de laboratorios con IA, explicable y verificable</p>
        </header>
      </div>

      <main className="mx-auto -mt-7 flex max-w-[1180px] flex-col gap-[22px] px-[clamp(16px,4vw,40px)] pb-16">
        <section className={`${card} flex flex-col gap-3 px-[clamp(20px,3vw,36px)] py-7`}>
          <h2 className="text-[28px]">Abstract</h2>
          <p className="text-[15.5px] leading-[1.7] text-slate-600">
            Este proyecto es una plataforma web que ayuda a los estudiantes a interpretar y autoevaluar, con apoyo de inteligencia artificial, los laboratorios que desarrollaron en una materia. Para cada
            laboratorio, el estudiante entrega su descripción y objetivos, la rúbrica y su solución; la plataforma analiza las evidencias, valora cada criterio y señala qué aprendió, cómo lo aplicó y qué
            necesita fortalecer.
          </p>
          <p className="text-[15.5px] leading-[1.7] text-slate-600">
            Su propósito es que la IA sea una aliada del aprendizaje y no un juez definitivo. Por eso cada valoración cita evidencias que el sistema comprueba en los archivos, la nota orientativa de 0,0 a 5,0 la
            calcula el sistema con las ponderaciones de la rúbrica, y un docente puede revisar y ajustar el resultado antes de darlo por válido. Con los resultados de todos los laboratorios se genera un informe
            integral con un plan de fortalecimiento y un mapa mental interactivo con el nivel de dominio de cada tema.
          </p>
          <p className="rounded-xl bg-blue-50 px-3.5 py-2.5 text-[13px] leading-normal text-blue-800">
            Las calificaciones que muestra la plataforma son estimaciones con fines de autoevaluación; no son calificaciones oficiales ni sustituyen la evaluación del docente.
          </p>
        </section>

        <div className="flex flex-wrap items-start gap-[22px]">
          <section className={`${card} flex min-w-0 flex-[3_1_480px] flex-col gap-3.5 px-[clamp(20px,3vw,32px)] py-[26px]`}>
            <h2 className="text-[26px]">Funcionalidades</h2>
            <ol className="flex flex-col gap-2.5">
              {FEATURES.map((f, i) => (
                <li key={f.text} className="flex items-start gap-3 text-[14.5px] leading-[1.55] text-slate-600">
                  <span className={`flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-slate-900 ${f.bg}`}>{i + 1}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-[22px]">
            <section className={`${card} flex flex-col gap-3 p-[26px]`}>
              <h2 className="text-[26px]">Tecnologías</h2>
              <ul className="flex flex-wrap gap-2">
                {TECH.map((t) => (
                  <li key={t} className="rounded-full bg-brand-50 px-3 py-1.5 text-[13px] font-bold text-[#2B1767]">
                    {t}
                  </li>
                ))}
              </ul>
            </section>
            <section className="flex flex-col gap-2.5 rounded-[28px] bg-slate-900 p-[26px] text-white">
              <h2 className="text-[26px]">Aportes</h2>
              <p className="text-[14.5px] leading-[1.65] text-slate-200">
                Evaluaciones explicables, trazables y sujetas a validación docente: cada resultado conserva las evidencias, la versión de la rúbrica y el modelo usado. Además, el desarrollo se hizo con
                asistentes de IA, y las decisiones, problemas y límites quedaron documentados.
              </p>
            </section>
          </div>
        </div>

        <section aria-labelledby="equipo" className="flex flex-col gap-4">
          <h2 id="equipo" className="text-[28px]">Equipo desarrollador</h2>
          <ul className="grid gap-[18px] sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
            {TEAM.map((m) => (
              <li key={m.name} className="flex flex-col items-center gap-2 rounded-[26px] border border-slate-200 bg-white px-[22px] py-7 text-center">
                {m.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photo} alt={`Foto de ${m.name}`} className={`h-[132px] w-[132px] rounded-full border-4 border-white object-cover ring-[3px] ${m.ring}`} />
                ) : (
                  <div className="flex h-[132px] w-[132px] items-center justify-center rounded-full bg-slate-200 text-3xl font-semibold text-slate-600" aria-hidden="true">
                    {initials(m.name)}
                  </div>
                )}
                <p className="mt-2 text-[17px] font-extrabold">{m.name}</p>
                <p className="text-sm text-slate-600">{m.role}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
