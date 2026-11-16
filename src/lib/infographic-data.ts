// La infografía debe ser coherente con la retroalimentación: todo concepto que se marque "a reforzar" debe verse como tal.
// Se aplica al mostrar (no depende de la IA, y corrige también evaluaciones ya guardadas).
import type { FinalReport } from "./evaluate-summary";

type Infographic = FinalReport["infografia"];
type State = "demostrado" | "parcial" | "refuerzo";

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * ¿El concepto ya existente "cubre" lo pendiente? Sí si son iguales o si el existente es MÁS ESPECÍFICO que lo pendiente.
 * Si lo pendiente es más específico que el existente (p. ej. pendiente "Relación entre cuantización y perplexity" frente al
 * concepto amplio "Cuantización", que sí se demostró), NO se cambia el existente: lo pendiente se agrega como concepto nuevo.
 */
const covers = (existing: string, pending: string) => {
  const e = norm(existing);
  const p = norm(pending);
  if (!e || !p) return false;
  return e === p || (p.length >= 6 && e.includes(p));
};

export const PENDING_CATEGORY = "Por reforzar";

export function reconcileInfographic(info: Infographic | null, toReinforce: string[] | undefined): Infographic {
  const base: Infographic = info ? structuredClone(info) : { titulo: "", categorias: [] };
  const pending = (toReinforce ?? []).map((s) => s.trim()).filter(Boolean);
  if (pending.length === 0) return base;

  const missing: string[] = [];
  for (const name of pending) {
    let found = false;
    for (const cat of base.categorias)
      for (const sub of cat.subcategorias)
        for (const k of sub.conceptos)
          if (covers(k.nombre, name)) {
            k.estado = "refuerzo" as State; // la retroalimentación manda: si se pide reforzar, no puede figurar como demostrado
            found = true;
          }
    if (!found) missing.push(name);
  }

  if (missing.length > 0) {
    base.categorias.push({
      nombre: PENDING_CATEGORY,
      subcategorias: [{ nombre: "Conceptos pendientes de profundizar", conceptos: missing.map((nombre) => ({ nombre, estado: "refuerzo" as State })) }],
    });
  }
  return base;
}
