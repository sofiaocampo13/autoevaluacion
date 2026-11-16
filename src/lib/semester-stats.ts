// Estadísticas del semestre calculadas por el sistema (sin IA) solo con evaluaciones reales y completadas.
// La IA del análisis global recibe estos números ya hechos y no puede cambiarlos.
import { norm } from "./infographic-data";

export type SemesterLabInput = {
  lab: { id: string; name: string; number: number | null; cut: number | null };
  evaluation: {
    id: string;
    completedAt: string;
    overallPercent: number;
    estimatedGrade: number;
    reviewStatus: "preliminar" | "aprobada" | "ajustada" | "devuelta";
    finalPercent: number | null;
    finalGrade: number | null;
  };
  criteria: { criterion: string; competency: string; weight: number; percent: number; evidence: "suficiente" | "parcial" | "inexistente" }[];
  strengths: string[];
  weaknesses: string[];
  toReinforce: string[];
  concepts: { name: string; status: "demostrado" | "parcial" | "refuerzo" }[];
};

export type MasteryBand = "dominio" | "competente" | "en_desarrollo" | "inicial";
export const BAND_LABEL: Record<MasteryBand, string> = {
  dominio: "Dominio alto",
  competente: "Competente",
  en_desarrollo: "En desarrollo",
  inicial: "Inicial",
};
/** Banda propia de la plataforma (no es la de la rúbrica del docente): sirve para resumir, no para calificar. */
export const bandOf = (percent: number): MasteryBand => (percent >= 85 ? "dominio" : percent >= 70 ? "competente" : percent >= 50 ? "en_desarrollo" : "inicial");

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export type LabPoint = {
  labId: string;
  evaluationId: string;
  name: string;
  number: number | null;
  cut: number | null;
  date: string;
  percent: number; // el que cuenta: nota revisada por el docente si existe, si no la de la IA
  grade: number;
  aiPercent: number;
  reviewed: boolean;
  reviewStatus: SemesterLabInput["evaluation"]["reviewStatus"];
  band: MasteryBand;
};

export type CompetencyStat = {
  competency: string;
  derived: boolean; // true: la rúbrica no define competencias y se usa el nombre del criterio
  labs: number;
  criteria: number;
  percent: number; // promedio ponderado por el peso del criterio
  band: MasteryBand;
  first: number | null; // porcentaje en el primer laboratorio donde aparece
  last: number | null;
  delta: number | null; // last - first, solo si aparece en 2 o más laboratorios
  weakEvidence: number; // criterios con evidencia parcial o inexistente
};

export type CriterionGap = { criterion: string; competency: string; lab: string; labId: string; percent: number; evidence: string };

export type ConceptStat = {
  name: string;
  labs: string[];
  states: { demostrado: number; parcial: number; refuerzo: number };
  current: "demostrado" | "parcial" | "refuerzo"; // estado en el laboratorio más reciente donde aparece
  recurrent: boolean; // marcado "refuerzo" en 2 o más laboratorios
};

export type SemesterStats = {
  labsEvaluated: number;
  labsTotal: number;
  scaleMax: number;
  averagePercent: number;
  averageGrade: number;
  reviewedLabs: number;
  points: LabPoint[]; // orden cronológico por corte y número
  byCut: { cut: number | null; labs: number; averagePercent: number }[];
  trend: { first: number; last: number; delta: number } | null; // null con menos de 2 laboratorios
  bands: Record<MasteryBand, number>;
  competencies: CompetencyStat[]; // de menor a mayor porcentaje (las brechas primero)
  gaps: CriterionGap[]; // los criterios más bajos, máx. 8
  concepts: ConceptStat[]; // primero los recurrentes a reforzar
  recurringStrengths: string[];
  recurringWeaknesses: string[];
  pendingLabs: string[]; // laboratorios sin evaluación completada (los pone el cargador)
};

const effective = (e: SemesterLabInput["evaluation"]) => {
  const reviewed = (e.reviewStatus === "aprobada" || e.reviewStatus === "ajustada") && e.finalPercent != null && e.finalGrade != null;
  return reviewed ? { percent: e.finalPercent!, grade: e.finalGrade!, reviewed: true } : { percent: e.overallPercent, grade: e.estimatedGrade, reviewed: false };
};

export function computeSemesterStats(labs: SemesterLabInput[], labsTotal: number, scaleMax: number): SemesterStats {
  const ordered = [...labs].sort(
    (a, b) => (a.lab.cut ?? 99) - (b.lab.cut ?? 99) || (a.lab.number ?? 999) - (b.lab.number ?? 999) || a.evaluation.completedAt.localeCompare(b.evaluation.completedAt),
  );

  const points: LabPoint[] = ordered.map((l) => {
    const eff = effective(l.evaluation);
    return {
      labId: l.lab.id,
      evaluationId: l.evaluation.id,
      name: l.lab.name,
      number: l.lab.number,
      cut: l.lab.cut,
      date: l.evaluation.completedAt,
      percent: round(eff.percent, 2),
      grade: round(eff.grade, 2),
      aiPercent: round(l.evaluation.overallPercent, 2),
      reviewed: eff.reviewed,
      reviewStatus: l.evaluation.reviewStatus,
      band: bandOf(eff.percent),
    };
  });

  const n = points.length;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const cuts = [...new Set(points.map((p) => p.cut))];
  const byCut = cuts.map((cut) => {
    const ps = points.filter((p) => p.cut === cut);
    return { cut, labs: ps.length, averagePercent: round(avg(ps.map((p) => p.percent))) };
  });

  const bands: Record<MasteryBand, number> = { dominio: 0, competente: 0, en_desarrollo: 0, inicial: 0 };
  points.forEach((p) => bands[p.band]++);

  // Competencias: se agrupan por nombre (sin tildes ni mayúsculas) a través de todos los laboratorios.
  const comp = new Map<string, { name: string; derived: boolean; rows: { lab: number; weight: number; percent: number; evidence: string }[] }>();
  ordered.forEach((l, i) =>
    l.criteria.forEach((c) => {
      // Si la rúbrica no define competencias, cada criterio hace de competencia (se marca como `derived`).
      const derived = !c.competency.trim();
      const name = (derived ? c.criterion : c.competency).trim();
      const key = (derived ? "criterio:" : "") + norm(name);
      const g = comp.get(key) ?? { name, derived, rows: [] };
      g.rows.push({ lab: i, weight: c.weight, percent: c.percent, evidence: c.evidence });
      comp.set(key, g);
    }),
  );
  const weighted = (rows: { weight: number; percent: number }[]) => {
    const w = rows.reduce((a, r) => a + r.weight, 0);
    return w > 0 ? rows.reduce((a, r) => a + r.weight * r.percent, 0) / w : avg(rows.map((r) => r.percent));
  };
  const competencies: CompetencyStat[] = [...comp.values()]
    .map((g) => {
      const labIdx = [...new Set(g.rows.map((r) => r.lab))].sort((a, b) => a - b);
      const at = (i: number) => round(weighted(g.rows.filter((r) => r.lab === i)));
      const first = at(labIdx[0]);
      const last = at(labIdx[labIdx.length - 1]);
      const percent = round(weighted(g.rows));
      return {
        competency: g.name,
        derived: g.derived,
        labs: labIdx.length,
        criteria: g.rows.length,
        percent,
        band: bandOf(percent),
        first,
        last,
        delta: labIdx.length >= 2 ? round(last - first) : null,
        weakEvidence: g.rows.filter((r) => r.evidence !== "suficiente").length,
      };
    })
    .sort((a, b) => a.percent - b.percent);

  const gaps: CriterionGap[] = ordered
    .flatMap((l) => l.criteria.map((c) => ({ criterion: c.criterion, competency: c.competency, lab: l.lab.name, labId: l.lab.id, percent: c.percent, evidence: c.evidence })))
    .filter((g) => g.percent < 85 || g.evidence !== "suficiente")
    .sort((a, b) => a.percent - b.percent)
    .slice(0, 8);

  // Conceptos: el estado "actual" es el del laboratorio más reciente donde aparece; lo pedido a reforzar manda sobre lo demostrado.
  const con = new Map<string, ConceptStat>();
  ordered.forEach((l) => {
    const seen = new Map<string, "demostrado" | "parcial" | "refuerzo">();
    l.concepts.forEach((k) => seen.set(norm(k.name), k.status));
    l.toReinforce.forEach((name) => seen.set(norm(name), "refuerzo"));
    const names = new Map<string, string>();
    [...l.concepts.map((k) => k.name), ...l.toReinforce].forEach((nm) => names.set(norm(nm), nm.trim()));
    seen.forEach((status, key) => {
      if (!key) return;
      const c = con.get(key) ?? { name: names.get(key) ?? key, labs: [], states: { demostrado: 0, parcial: 0, refuerzo: 0 }, current: status, recurrent: false };
      c.states[status]++;
      c.labs.push(l.lab.name);
      c.current = status;
      con.set(key, c);
    });
  });
  const concepts = [...con.values()]
    .map((c) => ({ ...c, recurrent: c.states.refuerzo >= 2 }))
    .sort((a, b) => Number(b.recurrent) - Number(a.recurrent) || Number(b.current === "refuerzo") - Number(a.current === "refuerzo") || b.states.refuerzo - a.states.refuerzo);

  const recurring = (pick: (l: SemesterLabInput) => string[]) => {
    const m = new Map<string, { text: string; count: number }>();
    ordered.forEach((l) => new Set(pick(l).map((t) => norm(t))).forEach((k) => {
      const text = pick(l).find((t) => norm(t) === k) ?? k;
      const cur = m.get(k) ?? { text, count: 0 };
      cur.count++;
      m.set(k, cur);
    }));
    return [...m.values()].filter((x) => x.count >= 2).sort((a, b) => b.count - a.count).slice(0, 5).map((x) => x.text);
  };

  return {
    labsEvaluated: n,
    labsTotal,
    scaleMax,
    averagePercent: round(avg(points.map((p) => p.percent)), 2),
    averageGrade: round(avg(points.map((p) => p.grade)), 2),
    reviewedLabs: points.filter((p) => p.reviewed).length,
    points,
    byCut,
    trend: n >= 2 ? { first: points[0].percent, last: points[n - 1].percent, delta: round(points[n - 1].percent - points[0].percent, 2) } : null,
    bands,
    competencies,
    gaps,
    concepts,
    recurringStrengths: recurring((l) => l.strengths),
    recurringWeaknesses: recurring((l) => l.weaknesses),
    pendingLabs: [],
  };
}
