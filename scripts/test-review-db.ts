// Prueba de seguridad de la revisión docente contra la base real. Restaura la evaluación al terminar.
// Uso: node --env-file=.env.local --import tsx scripts/test-review-db.ts
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createReviewLink, hashToken, loadReviewView, revokeReviewLink, submitReview } from "../src/lib/review";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const SITE = "http://localhost:3000";
let n = 0;
const ok = async (name: string, fn: () => Promise<void>) => {
  await fn();
  n++;
  console.log("PASS ", name);
};
const tokenOf = (url: string) => url.split("/revision/")[1];
const base = { reviewerName: "Docente de Prueba", comment: "", decision: "aprobar" as const, adjustments: [] };

async function main() {
  const { data: ev } = await admin
    .from("evaluations")
    .select("*")
    .eq("status", "completada")
    .eq("review_status", "preliminar")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!ev) throw new Error("No hay una evaluación completada y preliminar para probar");

  const mk = async () => {
    const r = await createReviewLink(admin, ev.user_id, ev.id, SITE);
    assert.ok(r.ok);
    return r.ok ? tokenOf(r.url) : "";
  };

  try {
    const t1 = await mk();
    await ok("el enlace guardado es un hash, no el enlace (64 hex, distinto del token)", async () => {
      const { data } = await admin.from("review_links").select("token_hash").eq("token_hash", hashToken(t1)).single();
      assert.equal(data!.token_hash.length, 64);
      assert.notEqual(data!.token_hash, t1);
      const { data: all } = await admin.from("review_links").select("token_hash").eq("token_hash", t1);
      assert.equal(all!.length, 0);
    });
    await ok("el enlace tiene 43 caracteres y el docente ve la evaluación sin datos sensibles", async () => {
      assert.equal(t1.length, 43);
      const v = await loadReviewView(admin, t1);
      assert.ok(v && v.state === "activo" && v.criteria.length > 0);
      const dump = JSON.stringify(v);
      assert.ok(!dump.includes(ev.user_id), "no debe exponer el id del usuario");
      assert.ok(!dump.includes("storage_path"), "no debe exponer rutas internas de almacenamiento");
    });
    await ok("enlaces inventados, mal formados o vacíos → null (misma respuesta, sin pistas)", async () => {
      assert.equal(await loadReviewView(admin, "A".repeat(43)), null);
      assert.equal(await loadReviewView(admin, "../../" + "A".repeat(37)), null);
      assert.equal(await loadReviewView(admin, ""), null);
      assert.equal((await submitReview(admin, "A".repeat(43), base)).ok, false);
    });
    await ok("sin nombre, nombre de 1 letra o correo inválido se rechazan", async () => {
      assert.equal((await submitReview(admin, t1, { ...base, reviewerName: "" })).ok, false);
      assert.equal((await submitReview(admin, t1, { ...base, reviewerName: "A" })).ok, false);
      assert.equal((await submitReview(admin, t1, { ...base, reviewerEmail: "no-es-correo" })).ok, false);
    });
    await ok("devolver sin explicar el motivo se rechaza", async () => {
      assert.equal((await submitReview(admin, t1, { ...base, decision: "devolver", comment: "no" })).ok, false);
    });
    await ok("ajuste sin justificación, porcentaje 150 o criterio inexistente se rechazan", async () => {
      assert.equal((await submitReview(admin, t1, { ...base, adjustments: [{ position: 0, adjustedPercent: 10, justification: "" }] })).ok, false);
      assert.equal((await submitReview(admin, t1, { ...base, adjustments: [{ position: 0, adjustedPercent: 150, justification: "justificación válida" }] })).ok, false);
      assert.equal((await submitReview(admin, t1, { ...base, adjustments: [{ position: 99, adjustedPercent: 50, justification: "justificación válida" }] })).ok, false);
    });
    await ok("tras los intentos inválidos la evaluación sigue intacta y el enlace sigue activo", async () => {
      const { data } = await admin.from("evaluations").select("review_status, final_grade").eq("id", ev.id).single();
      assert.equal(data!.review_status, "preliminar");
      assert.equal(data!.final_grade, null);
      assert.equal((await loadReviewView(admin, t1))!.state, "activo");
    });

    const tRev = await mk();
    await ok("un enlace revocado no muestra datos ni acepta revisiones; solo su dueño puede revocar", async () => {
      const { data: l } = await admin.from("review_links").select("id").eq("token_hash", hashToken(tRev)).single();
      assert.equal(await revokeReviewLink(admin, "00000000-0000-0000-0000-000000000000", l!.id), false);
      assert.equal(await revokeReviewLink(admin, ev.user_id, l!.id), true);
      const v = await loadReviewView(admin, tRev);
      assert.equal(v!.state, "revocado");
      assert.equal(v!.criteria, undefined);
      assert.equal((await submitReview(admin, tRev, base)).ok, false);
    });
    const tExp = await mk();
    await ok("un enlace vencido no muestra datos ni acepta revisiones", async () => {
      await admin.from("review_links").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", hashToken(tExp));
      const v = await loadReviewView(admin, tExp);
      assert.equal(v!.state, "expirado");
      assert.equal(v!.criteria, undefined);
      assert.equal((await submitReview(admin, tExp, base)).ok, false);
    });

    await ok("tres envíos simultáneos con el mismo enlace: solo UNO se registra", async () => {
      const rs = await Promise.all([submitReview(admin, t1, base), submitReview(admin, t1, base), submitReview(admin, t1, base)]);
      assert.equal(rs.filter((r) => r.ok).length, 1, JSON.stringify(rs));
      const { data } = await admin.from("teacher_reviews").select("id").eq("evaluation_id", ev.id);
      assert.equal(data!.length, 1);
    });
    await ok("el enlace queda usado y ya no admite cambios", async () => {
      assert.equal((await loadReviewView(admin, t1))!.state, "usado");
      const r = await submitReview(admin, t1, { ...base, adjustments: [{ position: 0, adjustedPercent: 1, justification: "intento de cambiar después" }] });
      assert.equal(r.ok, false);
    });
    await ok("la evaluación quedó aprobada con la misma nota del sistema (sin ajustes)", async () => {
      const { data } = await admin.from("evaluations").select("*").eq("id", ev.id).single();
      assert.equal(data!.review_status, "aprobada");
      assert.equal(Number(data!.final_grade), Number(data!.estimated_grade));
      assert.equal(data!.reviewer_name, "Docente de Prueba");
    });
    await ok("no se pueden crear más enlaces para una evaluación ya revisada", async () => {
      assert.equal((await createReviewLink(admin, ev.user_id, ev.id, SITE)).ok, false);
    });
    await ok("un usuario ajeno no puede crear enlaces para esta evaluación", async () => {
      assert.equal((await createReviewLink(admin, "00000000-0000-0000-0000-000000000000", ev.id, SITE)).ok, false);
    });

    // Permisos de la base: nadie sin sesión puede leer estas tablas.
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    await ok("sin sesión no se pueden leer review_links ni teacher_reviews", async () => {
      const a = await anon.from("review_links").select("id");
      const b = await anon.from("teacher_reviews").select("id");
      assert.ok(a.error || (a.data ?? []).length === 0);
      assert.ok(b.error || (b.data ?? []).length === 0);
    });
    console.log(`\n${n} comprobaciones superadas`);
  } finally {
    // Restaurar: la evaluación vuelve a su estado original y se borra todo lo creado por la prueba.
    await admin.from("teacher_reviews").delete().eq("evaluation_id", ev.id);
    await admin.from("review_links").delete().eq("evaluation_id", ev.id);
    await admin
      .from("evaluations")
      .update({ review_status: "preliminar", final_percent: null, final_grade: null, reviewed_at: null, reviewer_name: null })
      .eq("id", ev.id);
    console.log("Limpieza hecha: la evaluación volvió a 'preliminar' y se borraron los enlaces y revisiones de prueba.");
  }
}
main().catch((e) => {
  console.error("FALLÓ:", e.message);
  process.exit(1);
});
