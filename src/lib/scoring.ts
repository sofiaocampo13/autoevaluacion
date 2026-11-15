// El cálculo de porcentajes y nota lo hace SIEMPRE el backend con los pesos de la rúbrica.
// El modelo de IA nunca calcula la nota.

export type ScoredCriterion = { weight: number; percent: number };

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Porcentaje global ponderado (0 a 100). Los pesos de una rúbrica confirmada suman 100. */
export function overallPercent(items: ScoredCriterion[]): number {
  const totalWeight = items.reduce((s, c) => s + c.weight, 0);
  if (totalWeight <= 0) return 0;
  return round(items.reduce((s, c) => s + (c.weight * c.percent) / totalWeight, 0), 2);
}

/** Nota orientativa en la escala configurada (0 a 5 o 0 a 100), con un decimal. */
export function estimatedGrade(percent: number, scaleMax: number): number {
  return round((percent / 100) * scaleMax, 1);
}

export const GRADE_DISCLAIMER =
  "Esta calificación es una estimación generada mediante inteligencia artificial con fines de autoevaluación académica. No corresponde a una calificación oficial ni sustituye la evaluación realizada por el docente.";
