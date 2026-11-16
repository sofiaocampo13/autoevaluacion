import Link from "next/link";
import { Icon } from "@/components/icons";
import { GRADE_DISCLAIMER } from "@/lib/scoring";
import type { ConceptStat, SemesterStats } from "@/lib/semester-stats";

type Props = {
  stats: SemesterStats;
  subjectName: string;
  period: string | null;
  firstName: string;
};

const card = "rounded-[20px] border border-slate-200 bg-white";
const panel = "rounded-[24px] border border-slate-200 bg-white";
const num = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
const day = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" }).replace(".", "");

// Estado de dominio del concepto: color + glifo + texto (nunca solo color).
const STATE = {
  demostrado: { label: "Demostrado", glyph: "✓", chip: "bg-blue-600 text-white" },
  parcial: { label: "Parcial", glyph: "◐", chip: "bg-brand-200 text-brand-900" },
  refuerzo: { label: "Requiere refuerzo", glyph: "!", chip: "bg-pink-600 text-white" },
} as const;

const MAX_CHIPS = 24;

/** Panel del semestre: indicadores, evolución, fortalezas/temas por reforzar, últimas evaluaciones y mapa de conceptos. Mismo componente en móvil y escritorio. */
export function PanelSemestre({ stats, subjectName, period, firstName }: Props) {
  const has = stats.labsEvaluated > 0;
  const pending = stats.labsTotal - stats.labsEvaluated;
  const scale = stats.scaleMax;
  const recent = [...stats.points].sort((a, b) => b.date.localeCompare(a.date));
  const last = recent[0];

  // Evolución: laboratorios evaluados y, después, los pendientes (barra punteada).
  const bars = [
    ...stats.points.map((p, i) => ({
      key: p.labId,
      name: p.name,
      label: p.number != null ? `Lab ${p.number}` : `Lab ${i + 1}`,
      short: p.number != null ? `L${p.number}` : `L${i + 1}`,
      percent: p.percent,
      grade: p.grade,
    })),
    ...stats.pendingLabs.map((n, i) => ({
      key: `pend-${i}`,
      name: n,
      label: `Lab ${stats.points.length + i + 1}`,
      short: `L${stats.points.length + i + 1}`,
      percent: null as number | null,
      grade: null as number | null,
    })),
  ];

  // Fortalezas y temas por reforzar: solo conceptos con evidencia real en los laboratorios evaluados.
  const strong = stats.concepts.filter((c) => c.current === "demostrado").sort((a, b) => b.states.demostrado - a.states.demostrado).slice(0, 3);
  const weak = stats.concepts.filter((c) => c.current === "refuerzo").slice(0, 3);
  const topWeak = weak[0];
  const chips = stats.concepts.slice(0, MAX_CHIPS);

  return (
    <div className="flex flex-col gap-5 md:gap-7">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-4">
        <div className="flex min-w-0 flex-col gap-1 md:gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-pink-600 md:text-[13px] md:font-bold">
            {subjectName} · {period ? `Periodo ${period}` : "Sin periodo"}
          </span>
          <h1 className="text-[30px] leading-[1.08] tracking-[-0.02em] md:text-[44px] md:leading-[1.05]">
            {firstName ? `Hola, ${firstName}. ` : "Hola. "}
            <em className="text-brand-600">Así va tu semestre.</em>
          </h1>
        </div>
        <div className="hidden flex-wrap gap-3 md:flex">
          <Link
            href="/laboratorios/nuevo"
            className="inline-flex min-h-12 items-center gap-2 rounded-full border-[1.5px] border-brand-600 bg-white px-5 text-sm font-bold text-brand-600 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
          >
            <Icon name="mas" className="h-[18px] w-[18px]" />
            Cargar nuevo laboratorio
          </Link>
          <Link
            href="/analisis"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-slate-800 px-[22px] text-[13px] font-extrabold uppercase tracking-[0.04em] text-white hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
          >
            <Icon name="analisis" className="h-[18px] w-[18px] text-pink-300" />
            Analizar mi desempeño del semestre
          </Link>
        </div>
      </header>

      {/* Indicadores: 2×2 en móvil, cinco tarjetas en escritorio. */}
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-2.5 lg:grid-cols-5 lg:gap-4">
        <div className={`${card} order-3 flex flex-col gap-2.5 p-3.5 lg:order-1 lg:px-[22px] lg:py-5`}>
          <span className="hidden text-[13px] font-semibold text-slate-500 lg:block">Laboratorios registrados</span>
          <span className="text-[11px] font-extrabold uppercase text-slate-600 lg:hidden">Evaluados</span>
          <span className="font-display text-[28px] font-medium leading-none text-blue-600 lg:hidden">
            {stats.labsEvaluated} de {stats.labsTotal}
          </span>
          <span className="hidden font-display text-[44px] font-medium leading-none lg:block">{stats.labsTotal}</span>
          <span className="hidden text-xs text-slate-500 lg:block">de la asignatura</span>
        </div>
        <div className={`${card} order-4 hidden flex-col gap-2.5 p-3.5 lg:order-2 lg:flex lg:px-[22px] lg:py-5`}>
          <span className="text-[13px] font-semibold text-slate-500">Evaluados</span>
          <span className="font-display text-[44px] font-medium leading-none text-blue-600">{stats.labsEvaluated}</span>
          <span className="text-xs text-slate-500">{last ? `último: ${day(last.date)}` : "aún sin evaluaciones"}</span>
        </div>
        <div className={`${card} order-4 flex flex-col gap-2.5 p-3.5 lg:order-3 lg:px-[22px] lg:py-5`}>
          <span className="text-[11px] font-extrabold uppercase text-slate-600 lg:text-[13px] lg:font-semibold lg:normal-case lg:text-slate-500">Pendientes</span>
          <span className="font-display text-[28px] font-medium leading-none text-pink-600 lg:text-[44px]">{pending}</span>
          <span className="hidden text-xs text-slate-500 lg:block">
            {pending === 0 ? "todo evaluado" : stats.pendingLabs.length > 0 ? `${stats.pendingLabs.slice(0, 2).join(" y ")}${stats.pendingLabs.length > 2 ? " y más" : ""} sin evaluar` : "sin evaluar"}
          </span>
        </div>
        <div className="order-1 flex flex-col gap-2.5 rounded-[20px] border border-brand-200 bg-brand-50 p-3.5 lg:order-4 lg:px-[22px] lg:py-5">
          <span className="text-[11px] font-extrabold uppercase text-brand-700 lg:text-[13px] lg:font-semibold lg:normal-case">
            <span className="lg:hidden">Cumplimiento</span>
            <span className="hidden lg:inline">Cumplimiento global</span>
          </span>
          <span className="font-display text-[32px] font-medium leading-none text-brand-700 lg:text-[44px]">{has ? `${num(stats.averagePercent)} %` : "—"}</span>
          <div className="hidden h-2 overflow-hidden rounded-full bg-white lg:block">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${has ? Math.min(100, stats.averagePercent) : 0}%` }} />
          </div>
        </div>
        <div className="order-2 flex flex-col gap-2.5 rounded-[20px] border border-pink-100 bg-pink-50 p-3.5 lg:order-5 lg:px-[22px] lg:py-5">
          <span className="text-[11px] font-extrabold uppercase text-pink-700 lg:text-[13px] lg:font-semibold lg:normal-case">
            <span className="lg:hidden">Promedio</span>
            <span className="hidden lg:inline">Promedio orientativo</span>
          </span>
          <span className="font-display text-[32px] font-medium leading-none text-pink-700 lg:text-[44px]">
            {has ? num(stats.averageGrade) : "—"}
            {has && <span className="text-[15px] lg:text-xl"> / {scale}</span>}
          </span>
          <span className="hidden text-xs text-pink-700 lg:block">Estimación IA · no oficial</span>
        </div>
      </section>

      {has && (
        <p role="note" className="-mt-2 flex items-start gap-2.5 rounded-[14px] border border-dashed border-[#D9CFEA] bg-white px-4 py-3 text-[12.5px] leading-normal text-slate-600">
          <Icon name="info" className="mt-px h-[18px] w-[18px] shrink-0 text-brand-600" />
          <span>{GRADE_DISCLAIMER}</span>
        </p>
      )}

      <section className="flex flex-wrap gap-5">
        <div className={`${panel} flex min-w-0 basis-full flex-col gap-4 p-4 md:gap-5 md:px-[26px] md:py-6 lg:flex-[3_1_520px]`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg md:text-2xl">Evolución del desempeño</h2>
            <span className="text-xs font-semibold text-slate-500">Cumplimiento por laboratorio · notas sobre {scale}</span>
          </div>
          {has ? (
            <>
              <ul className="flex h-24 items-end gap-2.5 border-b border-slate-200 px-1 md:h-60 md:gap-7">
                {bars.map((b) => (
                  <li key={b.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 md:gap-2" title={b.name}>
                    <span className={`hidden text-[13px] font-extrabold md:block ${b.percent == null ? "text-slate-500" : "text-brand-700"}`}>
                      {b.percent == null ? "—" : `${num(b.percent)} %`}
                    </span>
                    {b.percent == null ? (
                      <div className="h-[30%] w-full max-w-16 rounded-t-xl rounded-b border-[1.5px] border-dashed border-slate-400" />
                    ) : (
                      <div className="w-full max-w-16 rounded-t-xl rounded-b bg-brand-600" style={{ height: `${Math.max(2, Math.min(100, b.percent))}%` }} />
                    )}
                    <span className="sr-only">
                      {b.label}: {b.percent == null ? "pendiente de evaluar" : `${num(b.percent)} %, ${num(b.grade ?? 0)} de ${scale}`}
                    </span>
                  </li>
                ))}
              </ul>
              <ul aria-hidden="true" className="-mt-2 flex gap-2.5 px-1 md:-mt-3 md:gap-7">
                {bars.map((b) => (
                  <li key={b.key} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center">
                    <span className="text-[11px] font-extrabold text-slate-600 md:text-xs md:text-slate-800">
                      <span className="md:hidden">{b.short}</span>
                      <span className="hidden md:inline">{b.label}</span>
                    </span>
                    <span className="hidden text-[11px] text-slate-500 md:block">{b.grade == null ? "pendiente" : `${num(b.grade)} / ${scale}`}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-3 w-3 rounded bg-brand-600" />
                  Evaluado{stats.reviewedLabs > 0 ? ` (${stats.reviewedLabs} con revisión docente)` : ""}
                </span>
                {pending > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-3 w-3 rounded border-[1.5px] border-dashed border-slate-400" />
                    Pendiente de evaluar
                  </span>
                )}
              </div>
              {stats.labsEvaluated < 5 && (
                <p className="hidden text-[12.5px] text-slate-500 md:block">
                  Con {stats.labsEvaluated} {stats.labsEvaluated === 1 ? "laboratorio evaluado" : "laboratorios evaluados"} la tendencia es preliminar.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">Todavía no hay laboratorios evaluados. La evolución aparece cuando evalúes tu primer laboratorio.</p>
          )}
        </div>

        <div className="flex min-w-0 basis-full flex-col gap-5 lg:flex-[2_1_320px]">
          {/* Móvil: el tema más urgente en un bloque oscuro; en escritorio lo cubre la tarjeta «Temas por reforzar». */}
          {topWeak && (
            <div className="flex flex-col gap-1.5 rounded-[20px] bg-slate-900 p-4 text-[#F4EEFF] md:hidden">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-pink-300">Tema por reforzar</span>
              <span className="text-[15px] font-bold leading-snug">
                {topWeak.name} · {topWeak.states.refuerzo} de {stats.labsEvaluated} labs
              </span>
            </div>
          )}
          <ConceptList title="Fortalezas identificadas" dot="bg-blue-600" items={strong} count={(c) => c.states.demostrado} badge="bg-blue-50 text-blue-700" total={stats.labsEvaluated} empty="Aún no hay conceptos demostrados en tus laboratorios." />
          <ConceptList title="Temas por reforzar" dot="bg-pink-600" items={weak} count={(c) => c.states.refuerzo} badge="bg-pink-50 text-pink-700" total={stats.labsEvaluated} empty="No hay temas marcados para reforzar por ahora." />
        </div>
      </section>

      <section className="flex flex-wrap gap-5">
        <div className={`${panel} flex min-w-0 basis-full flex-col gap-4 p-4 md:px-[26px] md:py-6 lg:flex-[3_1_520px]`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg md:text-2xl">Últimas evaluaciones</h2>
            <Link href="/historial" className="text-[13px] font-bold text-brand-600 hover:text-brand-700 hover:underline">
              Ver historial completo
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">Cuando evalúes un laboratorio, aparecerá aquí.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th scope="col" className="px-2 py-2.5 font-bold">Laboratorio</th>
                      <th scope="col" className="px-2 py-2.5 font-bold">Fecha</th>
                      <th scope="col" className="px-2 py-2.5 font-bold">Cumplimiento</th>
                      <th scope="col" className="px-2 py-2.5 font-bold">Nota</th>
                      <th scope="col" className="px-2 py-2.5 font-bold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.slice(0, 4).map((p) => (
                      <tr key={p.evaluationId} className="border-t border-slate-100">
                        <td className="px-2 py-3.5">
                          <span className="font-bold">{p.number != null ? `Lab ${p.number} · ${p.name}` : p.name}</span>
                          {p.reviewed && <span className="ml-2 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">Revisada por docente</span>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3.5 text-slate-600">{day(p.date)}</td>
                        <td className="px-2 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 w-[90px] overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full bg-brand-600" style={{ width: `${Math.min(100, p.percent)}%` }} />
                            </div>
                            <span className="font-bold">{num(p.percent)} %</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-3.5 font-extrabold">{num(p.grade)} / {scale}</td>
                        <td className="whitespace-nowrap px-2 py-3.5">
                          <Link href={`/laboratorios/${p.labId}/evaluacion/${p.evaluationId}`} className="inline-flex min-h-11 items-center text-[13px] font-bold text-brand-600 hover:text-brand-700 hover:underline">
                            Ver<span className="sr-only"> evaluación de {p.name}</span>
                          </Link>
                          <a href={`/api/evaluaciones/${p.evaluationId}/informe?download=1`} className="ml-3 inline-flex min-h-11 items-center text-[13px] font-bold text-brand-600 hover:text-brand-700 hover:underline">
                            PDF<span className="sr-only"> de {p.name}</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="md:hidden">
                {recent.slice(0, 4).map((p) => (
                  <li key={p.evaluationId} className="border-t border-slate-100 first:border-0">
                    <Link href={`/laboratorios/${p.labId}/evaluacion/${p.evaluationId}`} className="flex min-h-11 items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{p.number != null ? `Lab ${p.number} · ${p.name}` : p.name}</span>
                        <span className="text-xs text-slate-500">{day(p.date)} · {num(p.percent)} %</span>
                      </span>
                      <span className="shrink-0 text-sm font-extrabold">{num(p.grade)} / {scale}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex min-w-0 basis-full flex-col gap-4 rounded-[24px] bg-slate-900 p-5 text-[#F4EEFF] md:px-[26px] md:py-6 lg:flex-[2_1_320px]">
          <h2 className="text-[22px]">Mapa de conceptos del semestre</h2>
          {chips.length > 0 ? (
            <>
              <p className="text-[13px] leading-normal text-[#C9BEE0]">
                Según la evidencia hallada en tus {stats.labsEvaluated} {stats.labsEvaluated === 1 ? "laboratorio evaluado" : "laboratorios evaluados"}.
              </p>
              <ul className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <li key={c.name} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold ${STATE[c.current].chip}`}>
                    <span aria-hidden="true">{STATE[c.current].glyph}</span>
                    {c.name}
                    <span className="sr-only"> ({STATE[c.current].label})</span>
                  </li>
                ))}
                {stats.concepts.length > MAX_CHIPS && <li className="inline-flex min-h-8 items-center px-1 text-[13px] text-[#DCD3EE]">y {stats.concepts.length - MAX_CHIPS} más</li>}
              </ul>
              <div className="mt-auto flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-[#DCD3EE]">
                {(Object.keys(STATE) as (keyof typeof STATE)[]).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className={`inline-flex h-4 w-4 items-center justify-center rounded text-[11px] font-extrabold ${STATE[k].chip}`}>{STATE[k].glyph}</span>
                    {STATE[k].label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[13px] leading-normal text-[#C9BEE0]">Los conceptos aparecen cuando evalúes tu primer laboratorio.</p>
          )}
          <Link
            href="/mapa"
            className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-pink-300 px-5 text-center text-sm font-extrabold text-slate-900 hover:bg-pink-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            Abrir infografía general de aprendizaje
          </Link>
        </div>
      </section>

      {/* Móvil: acciones principales al final, como en el diseño móvil. */}
      <div className="flex flex-col gap-3 md:hidden">
        <Link
          href="/laboratorios/nuevo"
          className="flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-brand-600 text-sm font-extrabold text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
        >
          <Icon name="mas" className="h-[18px] w-[18px]" />
          Cargar nuevo laboratorio
        </Link>
        <Link
          href="/analisis"
          className="flex min-h-[50px] items-center justify-center gap-2 rounded-full border-[1.5px] border-brand-600 bg-white text-sm font-bold text-brand-600 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
        >
          Analizar mi desempeño del semestre
        </Link>
      </div>
    </div>
  );
}

/** Tarjeta de conceptos con cuántos laboratorios evaluados los respaldan. */
function ConceptList({
  title,
  dot,
  items,
  count,
  badge,
  total,
  empty,
}: {
  title: string;
  dot: string;
  items: ConceptStat[];
  count: (c: ConceptStat) => number;
  badge: string;
  total: number;
  empty: string;
}) {
  return (
    <div className={`${panel} flex flex-col gap-3.5 px-6 py-[22px]`}>
      <h2 className="flex items-center gap-2.5 text-[22px]">
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="border-t border-slate-100 pt-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul>
          {items.map((c) => (
            <li key={c.name} className="flex justify-between gap-3 border-t border-slate-100 py-2.5">
              <span className="text-sm font-semibold">{c.name}</span>
              <span className={`h-fit shrink-0 rounded-full px-2.5 py-[3px] text-xs font-bold ${badge}`}>
                {count(c)} de {total} labs
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
