import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acerca del proyecto",
  description: "Plataforma web de autoevaluación académica con IA: objetivos, funcionalidades, tecnologías y equipo.",
};

// Las fotos están en public/equipo/. Si una integrante no tiene `photo`, se muestran sus iniciales.
const TEAM: { name: string; role: string; photo?: string }[] = [
  { name: "Sofía Ocampo Gómez", role: "Desarrollo", photo: "/equipo/sofia.jpg" },
  { name: "Adriana Vargas Herrera", role: "Diseño", photo: "/equipo/adriana.jpg" },
  { name: "Laura Rojas Castaño", role: "Análisis de requisitos y pruebas", photo: "/equipo/laura.jpg" },
];

const FEATURES = [
  "Carga de la descripción y los objetivos del laboratorio, su rúbrica y la solución del estudiante (documentos, código, carpetas, ZIP o repositorio de GitHub).",
  "Interpretación y parametrización de la rúbrica con revisión del estudiante: criterios, niveles de desempeño y ponderaciones que suman 100 %.",
  "Evaluación de cada laboratorio con IA, con citas de fragmentos que el sistema verifica en los archivos; la nota orientativa la calcula el sistema, no el modelo.",
  "Retroalimentación, recomendaciones e infografía por laboratorio, e informe PDF.",
  "Revisión docente mediante un enlace seguro, de un solo uso: el docente ajusta criterios con justificación y el sistema recalcula la nota.",
  "Informe integrado del semestre con evolución, brechas y plan personalizado de fortalecimiento, e infografía descargable.",
  "Mapa mental interactivo con el nivel de dominio de cada tema, las evidencias y lo que conviene profundizar.",
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

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="mb-6 text-sm">
          <Link className="text-indigo-700 hover:underline" href="/">← Volver a la plataforma</Link>
        </p>

        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-slate-500">Proyecto final · Profundización I · Inteligencia Artificial</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Asesor pedagógico inteligente</h1>
          <p className="mt-1 text-lg text-slate-600">Autoevaluación de laboratorios con IA, explicable y verificable</p>
        </header>

        <section className="mb-8 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Abstract</h2>
          <div className="space-y-3 text-slate-700">
            <p>
              Este proyecto es una plataforma web que ayuda a los estudiantes a interpretar y autoevaluar, con apoyo de inteligencia artificial, los laboratorios que desarrollaron en una materia. Para cada
              laboratorio, el estudiante entrega su descripción y objetivos, la rúbrica y su solución; la plataforma analiza las evidencias, valora cada criterio y señala qué aprendió, cómo lo aplicó y qué
              necesita fortalecer.
            </p>
            <p>
              Su propósito es que la IA sea una aliada del aprendizaje y no un juez definitivo. Por eso cada valoración cita evidencias que el sistema comprueba en los archivos, la nota orientativa de 0,0 a 5,0 la
              calcula el sistema con las ponderaciones de la rúbrica, y un docente puede revisar y ajustar el resultado antes de darlo por válido. Con los resultados de todos los laboratorios se genera un informe
              integral con un plan de fortalecimiento y un mapa mental interactivo con el nivel de dominio de cada tema.
            </p>
            <p className="text-sm text-slate-500">
              Las calificaciones que muestra la plataforma son estimaciones con fines de autoevaluación; no son calificaciones oficiales ni sustituyen la evaluación del docente.
            </p>
          </div>
        </section>

        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Funcionalidades</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              {FEATURES.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </section>
          <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Tecnologías</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              {TECH.map((t) => <li key={t}>{t}</li>)}
            </ul>
            <h2 className="mb-2 mt-6 text-lg font-semibold text-slate-900">Aportes</h2>
            <p className="text-sm text-slate-700">
              Evaluaciones explicables, trazables y sujetas a validación docente: cada resultado conserva las evidencias, la versión de la rúbrica y el modelo usado. Además, el desarrollo se hizo con
              asistentes de IA, y las decisiones, problemas y límites quedaron documentados.
            </p>
          </section>
        </div>

        <section aria-labelledby="equipo">
          <h2 id="equipo" className="mb-4 text-lg font-semibold text-slate-900">Equipo desarrollador</h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {TEAM.map((m) => (
              <li key={m.name} className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
                {m.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photo} alt={`Foto de ${m.name}`} className="mx-auto mb-3 h-24 w-24 rounded-full object-cover" />
                ) : (
                  <div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full bg-slate-200 text-2xl font-semibold text-slate-600" aria-hidden="true">
                    {initials(m.name)}
                  </div>
                )}
                <p className="font-medium text-slate-900">{m.name}</p>
                <p className="text-sm text-slate-600">{m.role}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
