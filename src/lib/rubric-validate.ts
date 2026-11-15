// Validación de rúbricas. Sin dependencias de servidor: se usa en el editor (en vivo) y en las acciones.

export type Level = { name: string; min_percent: number | null; descriptor: string };
export type Criterion = {
  competency: string;
  criterion: string;
  description: string;
  weight: number | null; // porcentaje; null = no informado
  levels: Level[];
};

export type Issue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  index?: number; // criterio afectado
};

const round2 = (n: number) => Math.round(n * 100) / 100;
export const sumWeights = (cs: Criterion[]) => round2(cs.reduce((s, c) => s + (c.weight ?? 0), 0));

/** Los errores impiden confirmar la rúbrica; las advertencias no. */
export function validateRubric(criteria: Criterion[]): Issue[] {
  const issues: Issue[] = [];
  if (criteria.length === 0) {
    return [{ code: "empty", severity: "error", message: "La rúbrica no tiene criterios." }];
  }

  const total = sumWeights(criteria);
  if (Math.abs(total - 100) > 0.01) {
    issues.push({
      code: "weights_sum",
      severity: "error",
      message: `Los pesos suman ${total} % y deben sumar 100 %.`,
    });
  }

  const seen = new Map<string, number>();
  criteria.forEach((c, i) => {
    const label = c.criterion.trim() || `Criterio ${i + 1}`;
    if (!c.criterion.trim()) issues.push({ code: "no_name", severity: "error", index: i, message: `Criterio ${i + 1}: falta el nombre.` });
    if (c.weight == null)
      issues.push({ code: "no_weight", severity: "error", index: i, message: `"${label}": no tiene peso. Indícalo o ajústalo.` });
    else if (c.weight <= 0)
      issues.push({ code: "zero_weight", severity: "warning", index: i, message: `"${label}": su peso es 0 %, no influirá en la nota.` });

    const key = c.criterion.trim().toLowerCase();
    if (key) {
      if (seen.has(key))
        issues.push({ code: "duplicate", severity: "warning", index: i, message: `"${label}" está repetido (también es el criterio ${seen.get(key)! + 1}).` });
      else seen.set(key, i);
    }

    if (c.levels.length < 2)
      issues.push({ code: "few_levels", severity: "warning", index: i, message: `"${label}": tiene menos de 2 niveles de desempeño; la valoración será menos precisa.` });
    if (c.levels.some((l) => !l.descriptor.trim()))
      issues.push({ code: "no_descriptor", severity: "warning", index: i, message: `"${label}": hay niveles sin descriptor.` });

    const mins = c.levels.map((l) => l.min_percent).filter((m): m is number => m != null);
    if (mins.some((m) => m < 0 || m > 100))
      issues.push({ code: "level_range", severity: "error", index: i, message: `"${label}": un nivel tiene un porcentaje fuera de 0 a 100.` });
    if (new Set(mins).size !== mins.length)
      issues.push({ code: "level_overlap", severity: "warning", index: i, message: `"${label}": dos niveles comparten el mismo porcentaje mínimo.` });
  });

  return issues;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.severity === "error");

/** Reparte los pesos proporcionalmente para que sumen exactamente 100 (el ajuste de redondeo va al mayor). */
export function normalizeWeights(criteria: Criterion[]): Criterion[] {
  const total = criteria.reduce((s, c) => s + (c.weight ?? 0), 0);
  if (total <= 0) return criteria;
  const scaled = criteria.map((c) => ({ ...c, weight: round2(((c.weight ?? 0) / total) * 100) }));
  const diff = round2(100 - scaled.reduce((s, c) => s + (c.weight ?? 0), 0));
  if (diff !== 0) {
    let imax = 0;
    scaled.forEach((c, i) => (c.weight! > scaled[imax].weight! ? (imax = i) : 0));
    scaled[imax].weight = round2(scaled[imax].weight! + diff);
  }
  return scaled;
}
