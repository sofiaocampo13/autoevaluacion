// Prueba de los límites de uso de la IA contra la base real (requiere aplicar antes la migración 0008).
// Usa topes pequeños pasados por parámetro y borra lo que crea. Uso: node --env-file=.env.local --import tsx scripts/test-ai-budget.ts
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { AI_COST, releaseAi, reserveAi } from "../src/lib/ai-budget";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let n = 0;
const ok = async (name: string, fn: () => Promise<void>) => {
  await fn();
  n++;
  console.log("PASS ", name);
};
const HUGE = 1_000_000;

async function main() {
  const { data: profiles } = await admin.from("profiles").select("id").limit(2);
  if (!profiles || profiles.length < 1) throw new Error("No hay perfiles para probar");
  const [u1, u2] = [profiles[0].id, profiles[1]?.id];
  const created: string[] = [];
  const track = (r: Awaited<ReturnType<typeof reserveAi>>) => {
    if (r.ok) created.push(r.id);
    return r;
  };
  const { data: before } = await admin.from("ai_usage").select("units").eq("user_id", u1).gt("created_at", new Date(Date.now() - 864e5).toISOString());
  const usedBefore = (before ?? []).reduce((a, r) => a + r.units, 0);

  try {
    await ok("dentro del tope por usuario, la reserva se acepta y queda registrada", async () => {
      const r = track(await reserveAi(admin, u1, "analisis", { user: usedBefore + 1, global: HUGE }));
      assert.equal(r.ok, true);
    });
    await ok("al llegar al tope por usuario se rechaza con un mensaje claro (y no registra nada)", async () => {
      const r = await reserveAi(admin, u1, "analisis", { user: usedBefore + 1, global: HUGE });
      assert.equal(r.ok, false);
      if (!r.ok) assert.match(r.error, /límite diario/);
    });
    await ok(`una evaluación cuesta ${AI_COST.evaluacion}: con solo ${AI_COST.evaluacion - 1} unidades libres se rechaza`, async () => {
      const r = await reserveAi(admin, u1, "evaluacion", { user: usedBefore + 1 + AI_COST.evaluacion - 1, global: HUGE });
      assert.equal(r.ok, false);
    });
    await ok("liberar la reserva devuelve el cupo", async () => {
      const first = created.pop()!;
      await releaseAi(admin, first);
      const r = track(await reserveAi(admin, u1, "analisis", { user: usedBefore + 1, global: HUGE }));
      assert.equal(r.ok, true);
    });
    await ok("el tope global se aplica aunque el usuario tenga cupo propio", async () => {
      const { data: all } = await admin.from("ai_usage").select("units").gt("created_at", new Date(Date.now() - 864e5).toISOString());
      const usedGlobal = (all ?? []).reduce((a, r) => a + r.units, 0);
      const r = await reserveAi(admin, u2 ?? u1, "analisis", { user: HUGE, global: usedGlobal });
      assert.equal(r.ok, false);
      if (!r.ok) assert.match(r.error, /plataforma alcanzó/);
    });
    await ok("las reservas concurrentes no superan el tope (solo 2 de 6 caben)", async () => {
      const room = usedBefore + 3; // ya hay 1 reserva propia de esta prueba: caben 2 más de 1 unidad
      const rs = await Promise.all(Array.from({ length: 6 }, () => reserveAi(admin, u1, "analisis", { user: room, global: HUGE })));
      rs.forEach(track);
      assert.equal(rs.filter((r) => r.ok).length, 2);
    });
    await ok("un usuario con la clave pública no puede reservar ni escribir en ai_usage", async () => {
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
      const rpc = await anon.rpc("reserve_ai_budget", { p_user: u1, p_kind: "analisis", p_units: 1, p_user_limit: HUGE, p_global_limit: HUGE });
      assert.ok(rpc.error, "la función no debe ser ejecutable sin sesión de servicio");
      const ins = await anon.from("ai_usage").insert({ user_id: u1, kind: "analisis", units: 1 });
      assert.ok(ins.error);
    });
  } finally {
    if (created.length) await admin.from("ai_usage").delete().in("id", created);
  }
  console.log(`\n${n} comprobaciones superadas`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
