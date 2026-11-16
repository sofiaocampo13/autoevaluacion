// Árbol del mapa mental, construido SOLO con evaluaciones reales y las estadísticas calculadas por el sistema.
// No hay nada decorativo: cada nodo sale de un dato guardado y su panel de detalle dice de dónde.
import type { FinalReport } from "./evaluate-summary";
import { norm, reconcileInfographic } from "./infographic-data";
import { BAND_LABEL, bandOf, type MasteryBand, type SemesterStats } from "./semester-stats";
import type { SemesterAnalysis } from "./evaluate-semester";

export type MindState = "demostrado" | "parcial" | "refuerzo" | "sin_evaluar" | "neutro";

export type MindEvidence = { label: string; text: string; verified: boolean };
export type MindNode = {
  id: string;
  label: string;
  kind: "root" | "branch" | "cut" | "lab" | "criterion" | "theme" | "subtheme" | "concept" | "gap" | "action" | "pending";
  state: MindState;
  percent?: number;
  band?: MasteryBand;
  /** Solo en grupos: cuántos elementos evaluados contiene, cuántos demostrados y cuántos por reforzar. */
  stats?: { strong: number; total: number; weak: number; unit: string };
  detail: {
    title: string;
    lines: string[]; // datos del nodo
    evidence: MindEvidence[]; // citas reales de la evaluación
    deepen: string[]; // qué profundizar
    link?: { href: string; text: string }; // al laboratorio / evaluación de donde sale
  };
  children: MindNode[];
};

export type LabDetail = {
  labId: string;
  evaluationId: string;
  name: string;
  cut: number | null;
  number: number | null;
  infographic: FinalReport["infografia"] | null;
  toReinforce: string[];
  recommendations: string[];
  criteria: {
    criterion: string;
    percent: number;
    evidence: "suficiente" | "parcial" | "inexistente";
    recommendation: string;
    citations: { location: string; quote: string; status: "verificada" | "no_verificable" | "invalida" }[];
  }[];
};

const EVALUATED: MindState[] = ["demostrado", "parcial", "refuerzo"];
const leavesOf = (n: MindNode): MindNode[] => (n.children.length ? n.children.flatMap(leavesOf) : [n]);
/**
 * Color de un grupo. Si tiene porcentaje propio (laboratorio, corte) se usan los mismos umbrales que los criterios;
 * si no (temas, ramas), manda la mayoría de sus elementos: verde si al menos la mitad está demostrada.
 * Lo que haya que reforzar no se pierde: cada nodo muestra cuántos tiene debajo (`stats`) y los hijos conservan su color.
 */
function groupState(children: MindNode[], percent?: number): MindState {
  if (percent != null) return percent >= 85 ? "demostrado" : percent >= 70 ? "parcial" : "refuerzo";
  const ls = children.flatMap(leavesOf).filter((l) => EVALUATED.includes(l.state));
  if (ls.length === 0) return "neutro";
  if (ls.filter((l) => l.state === "demostrado").length / ls.length >= 0.5) return "demostrado";
  return ls.filter((l) => l.state === "refuerzo").length / ls.length > 0.5 ? "refuerzo" : "parcial";
}

/** Cuenta de elementos evaluados bajo cada grupo (no se calcula bajo «Qué profundizar», que ya es la lista de brechas). */
function annotate(n: MindNode): MindNode {
  const kids = n.children.map(annotate);
  if (!kids.length || n.kind === "root" || n.kind === "pending" || n.id === "b-prof" || n.id === "plan") return { ...n, children: kids };
  const ls = kids.flatMap(leavesOf).filter((l) => EVALUATED.includes(l.state));
  const unit = ls.every((l) => l.kind === "concept") ? "conceptos" : ls.every((l) => l.kind === "criterion") ? "criterios" : "elementos";
  return { ...n, children: kids, stats: ls.length ? { strong: ls.filter((l) => l.state === "demostrado").length, total: ls.length, weak: ls.filter((l) => l.state === "refuerzo").length, unit } : undefined };
}

const labHref = (labId: string, evalId: string) => `/laboratorios/${labId}/evaluacion/${evalId}`;
const node = (n: Omit<MindNode, "children" | "detail"> & { children?: MindNode[]; detail?: Partial<MindNode["detail"]> & { title?: string } }): MindNode => ({
  ...n,
  detail: { title: n.label, lines: [], evidence: [], deepen: [], ...n.detail },
  children: n.children ?? [],
});

export function buildMindMap(subjectName: string, stats: SemesterStats, labs: LabDetail[], analysis: SemesterAnalysis | null): MindNode {
  const conceptByKey = new Map(stats.concepts.map((c) => [norm(c.name), c]));
  const conceptState = (name: string, fallback: MindState): MindState => (conceptByKey.get(norm(name))?.current as MindState | undefined) ?? fallback;

  // ── Rama 1: temas (las categorías de las infografías de cada laboratorio, unidas por nombre) ──
  type Sub = { name: string; concepts: Map<string, { name: string; state: MindState }> };
  const themes = new Map<string, { name: string; subs: Map<string, Sub> }>();
  for (const l of labs) {
    const info = reconcileInfographic(l.infographic, l.toReinforce);
    for (const cat of info.categorias) {
      const t = themes.get(norm(cat.nombre)) ?? { name: cat.nombre, subs: new Map<string, Sub>() };
      for (const sub of cat.subcategorias) {
        const s = t.subs.get(norm(sub.nombre)) ?? { name: sub.nombre, concepts: new Map() };
        for (const k of sub.conceptos) s.concepts.set(norm(k.nombre), { name: k.nombre, state: conceptState(k.nombre, k.estado) });
        t.subs.set(norm(sub.nombre), s);
      }
      themes.set(norm(cat.nombre), t);
    }
  }
  const themeNodes: MindNode[] = [...themes.values()].map((t, ti) => {
    const subs = [...t.subs.values()].map((s, si) => {
      const concepts = [...s.concepts.values()].map((k, ki) => {
        const stat = conceptByKey.get(norm(k.name));
        return node({
          id: `t${ti}.${si}.${ki}`,
          label: k.name,
          kind: "concept",
          state: k.state,
          detail: {
            lines: [
              `Estado actual: ${k.state === "demostrado" ? "demostrado" : k.state === "parcial" ? "parcial" : "por reforzar"}`,
              ...(stat ? [`Aparece en: ${stat.labs.join(", ")}`, ...(stat.recurrent ? ["Se pidió reforzar en 2 o más laboratorios (recurrente)."] : [])] : []),
            ],
            deepen: k.state === "refuerzo" ? [`Repasa «${k.name}» y vuelve a evaluar el laboratorio donde apareció.`] : [],
          },
        });
      });
      return node({ id: `t${ti}.${si}`, label: s.name, kind: "subtheme", state: groupState(concepts), children: concepts, detail: { lines: [`${concepts.length} concepto(s)`] } });
    });
    const state = groupState(subs);
    return node({
      id: `t${ti}`,
      label: t.name,
      kind: "theme",
      state,
      children: subs,
      detail: { lines: [`${subs.reduce((a, s) => a + s.children.length, 0)} concepto(s) en ${subs.length} subtema(s)`] },
    });
  });

  // ── Rama 2: laboratorios por corte → laboratorio → criterio (con sus evidencias) ──
  const cuts = [...new Set(stats.points.map((p) => p.cut))];
  const cutNodes: MindNode[] = cuts.map((cut, ci) => {
    const labNodes = stats.points
      .filter((p) => p.cut === cut)
      .map((p, li) => {
        const d = labs.find((l) => l.labId === p.labId);
        const crit = (d?.criteria ?? []).map((c, k) =>
          node({
            id: `l${ci}.${li}.${k}`,
            label: c.criterion,
            kind: "criterion",
            state: c.percent >= 85 && c.evidence === "suficiente" ? "demostrado" : c.percent >= 70 ? "parcial" : "refuerzo",
            percent: c.percent,
            band: bandOf(c.percent),
            detail: {
              lines: [`${c.percent} % · ${BAND_LABEL[bandOf(c.percent)]}`, `Evidencia: ${c.evidence}`],
              evidence: c.citations.slice(0, 3).map((x) => ({ label: x.location, text: x.quote, verified: x.status === "verificada" })),
              deepen: c.percent < 85 || c.evidence !== "suficiente" ? [c.recommendation].filter(Boolean) : [],
              link: d ? { href: labHref(d.labId, d.evaluationId), text: "Abrir la evaluación" } : undefined,
            },
          }),
        );
        return node({
          id: `l${ci}.${li}`,
          label: p.name,
          kind: "lab",
          state: groupState(crit, p.percent),
          percent: p.percent,
          band: p.band,
          children: crit,
          detail: {
            lines: [`${p.percent} % · ${BAND_LABEL[p.band]}`, p.reviewed ? "Nota revisada por un docente." : "Nota preliminar (sin revisión docente).", ...(p.reviewed ? [`Estimación de la IA: ${p.aiPercent} %`] : [])],
            deepen: d?.recommendations.slice(0, 4) ?? [],
            link: d ? { href: labHref(d.labId, d.evaluationId), text: "Abrir la evaluación" } : undefined,
          },
        });
      });
    const avg = stats.byCut.find((c) => c.cut === cut)?.averagePercent;
    return node({
      id: `c${ci}`,
      label: cut ? `Corte ${cut}` : "Sin corte",
      kind: "cut",
      state: groupState(labNodes, avg),
      percent: avg,
      band: avg != null ? bandOf(avg) : undefined,
      children: labNodes,
      detail: { lines: [`${labNodes.length} laboratorio(s) evaluado(s)`, ...(avg != null ? [`Promedio del corte: ${avg} %`] : [])] },
    });
  });
  if (stats.pendingLabs.length > 0)
    cutNodes.push(
      node({
        id: "pend",
        label: "Sin evaluar",
        kind: "pending",
        state: "sin_evaluar",
        children: stats.pendingLabs.map((n, i) => node({ id: `pend.${i}`, label: n, kind: "pending", state: "sin_evaluar", detail: { lines: ["Todavía no tiene una evaluación en la plataforma."], deepen: ["Súbele los archivos (si falta) y evalúalo."] } })),
        detail: { lines: [`${stats.pendingLabs.length} laboratorio(s) sin evaluación: no entran en los promedios.`] },
      }),
    );

  // ── Rama 3: qué profundizar (conceptos por reforzar + el plan de la IA, si existe) ──
  const gaps = stats.concepts.filter((c) => c.current === "refuerzo");
  const gapNodes = gaps.map((c, i) =>
    node({
      id: `g${i}`,
      label: c.name,
      kind: "gap",
      state: "refuerzo",
      detail: {
        lines: [`Aparece en: ${c.labs.join(", ")}`, ...(c.recurrent ? ["Recurrente: se pidió reforzar en 2 o más laboratorios."] : [])],
        deepen: [`Repasa «${c.name}» y vuelve a evaluar ${c.labs.length === 1 ? "ese laboratorio" : "esos laboratorios"}.`],
      },
    }),
  );
  const planNodes = (analysis?.plan.acciones ?? []).map((a, i) =>
    node({
      id: `p${i}`,
      label: a.tema,
      kind: "action",
      state: a.prioridad === "alta" ? "refuerzo" : a.prioridad === "media" ? "parcial" : "neutro",
      detail: { lines: [`Prioridad ${a.prioridad} · ${a.tiempo}`, `Logro: ${a.logro}`, ...(a.laboratorios.length ? [`Relacionado con: ${a.laboratorios.join(", ")}`] : [])], deepen: a.pasos },
    }),
  );
  const deepenChildren = [
    ...(planNodes.length ? [node({ id: "plan", label: "Plan de fortalecimiento", kind: "branch", state: "neutro", children: planNodes, detail: { lines: ["Acciones del análisis del semestre (redactadas por la IA sobre tus datos)."] } })] : []),
    ...gapNodes,
  ];

  const branches = [
    node({ id: "b-temas", label: "Temas", kind: "branch", state: groupState(themeNodes), children: themeNodes, detail: { lines: ["Conceptos organizados por tema, tomados de las infografías de tus evaluaciones."] } }),
    node({ id: "b-labs", label: "Laboratorios", kind: "branch", state: groupState(cutNodes.filter((c) => c.kind === "cut")), children: cutNodes, detail: { lines: ["Por corte, con su nivel de dominio y las evidencias de cada criterio."] } }),
    node({ id: "b-prof", label: "Qué profundizar", kind: "branch", state: gaps.length ? "refuerzo" : "demostrado", children: deepenChildren, detail: { lines: gaps.length ? [`${gaps.length} concepto(s) por reforzar.`] : ["No hay conceptos por reforzar en tus evaluaciones."] } }),
  ].filter((b) => b.children.length > 0 || b.id === "b-prof");

  return annotate(
    node({
      id: "root",
      label: subjectName,
      kind: "root",
      state: "neutro",
      percent: stats.labsEvaluated ? stats.averagePercent : undefined,
      children: branches,
      detail: {
        lines: [`${stats.labsEvaluated} de ${stats.labsTotal} laboratorios evaluados`, ...(stats.labsEvaluated ? [`Promedio: ${stats.averagePercent} %`] : []), "Estimación orientativa; no es una nota oficial."],
      },
    }),
  );
}

/**
 * Vista «solo fortalezas»: deja únicamente lo demostrado (conserva las ramas que lo contienen) y quita
 * lo parcial, lo por reforzar, lo sin evaluar y el plan. No cambia ningún dato: es solo un filtro de visualización.
 */
function prune(n: MindNode): MindNode | null {
  if (n.kind === "gap" || n.kind === "action" || n.kind === "pending" || n.id === "b-prof") return null;
  if (n.kind === "root" && n.children.length === 0) return n;
  if (n.children.length === 0) return n.state === "demostrado" ? n : null;
  const kids = n.children.map(prune).filter((k): k is MindNode => k !== null);
  if (kids.length === 0 && n.kind !== "root") return null;
  return { ...n, children: kids, state: n.kind === "root" ? n.state : groupState(kids) };
}
export const onlyStrengths = (root: MindNode): MindNode | null => {
  const s = prune(root);
  return s && annotate(s);
};

export const countNodes =(n: MindNode): number => 1 + n.children.reduce((a, c) => a + countNodes(c), 0);
