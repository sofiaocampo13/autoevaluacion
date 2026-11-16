// Prueba de aislamiento entre usuarios sobre TODAS las tablas, el almacenamiento y las funciones (base real).
// Crea dos usuarios temporales (A y B) con la clave de servicio —no depende de «Confirm email»— y los borra al terminar.
// Contra datos reales solo hace lecturas, escrituras SIN efecto (se reescribe el mismo valor) e inserciones que deben fallar;
// lo destructivo (borrar) se prueba solo sobre filas y archivos creados por la propia prueba.
// Uso: node --env-file=.env.local --import tsx scripts/test-isolation-full.mts
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const stamp = Date.now();
const results: boolean[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

const TABLES = [
  "profiles", "subjects", "reference_materials", "labs", "lab_files", "evaluations", "criterion_results", "reports",
  "semester_analyses", "rubrics", "rubric_criteria", "review_links", "teacher_reviews", "ai_usage",
];
// Tablas cuyo contenido solo escribe el servidor: el estudiante no debe poder insertar ni siquiera a su nombre.
const SERVER_ONLY = ["evaluations", "criterion_results", "reports", "semester_analyses", "review_links", "teacher_reviews", "ai_usage"];

async function newUser(tag: string) {
  const email = `aislamiento-${tag}-${stamp}@example.test`;
  const password = "Prueba-" + crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: tag } });
  if (error || !data.user) throw error ?? new Error(`no se creó ${tag}`);
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  return { c, id: data.user.id };
}

const cleanup: (() => Promise<unknown>)[] = [];
// Un rechazo cuenta como PRUEBA solo si lo dice la seguridad (RLS o permisos), no un error cualquiera de datos incompletos.
const deniedBySecurity = (e: { message: string } | null) => !!e && /row-level security|permission denied|violates row-level/i.test(e.message);

async function main() {
  const A = await newUser("A");
  const B = await newUser("B");
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  cleanup.push(() => admin.auth.admin.deleteUser(A.id), () => admin.auth.admin.deleteUser(B.id));

  try {
    // ── Datos de A (creados por A con su propia sesión) ──
    const { data: subj, error: e1 } = await A.c.from("subjects").insert({ name: "Asignatura de A", grade_scale_max: 5 }).select().single();
    check("A puede crear su asignatura", !e1 && !!subj, e1?.message);
    const { data: lab, error: e2 } = await A.c.from("labs").insert({ name: "Lab A", subject_id: subj!.id }).select().single();
    check("A puede crear su laboratorio", !e2 && !!lab, e2?.message);
    const aPath = `${A.id}/secreto.txt`;
    const { error: eUp } = await A.c.storage.from("documents").upload(aPath, new Blob(["datos de A"]));
    check("A puede subir a su carpeta", !eUp, eUp?.message);
    cleanup.push(() => admin.storage.from("documents").remove([aPath]));

    // ── B no ve nada de A ni de los usuarios reales, en NINGUNA tabla ──
    for (const t of TABLES) {
      const real = await admin.from(t).select("*", { count: "exact", head: true });
      const r = await B.c.from(t).select("*").limit(5);
      const rows = r.data?.length ?? 0;
      const expected = t === "profiles" ? 1 : 0; // B solo puede ver su propio perfil
      check(`B no ve filas ajenas en «${t}»`, (r.error != null && rows === 0) || rows === expected, `${real.count ?? "?"} filas existen; B ve ${rows}${r.error ? " (error: " + r.error.message.slice(0, 40) + ")" : ""}`);
    }
    for (const t of TABLES) {
      const r = await anon.from(t).select("*").limit(5);
      check(`Un visitante sin sesión no lee «${t}»`, r.error != null || (r.data?.length ?? 0) === 0);
    }

    // ── Almacenamiento ──
    const { data: dl } = await B.c.storage.from("documents").download(aPath);
    check("B no puede descargar archivos de A", !dl);
    const { error: eUpB } = await B.c.storage.from("documents").upload(`${A.id}/intruso.txt`, new Blob(["x"]));
    check("B no puede subir a la carpeta de A", !!eUpB);
    const list = await B.c.storage.from("documents").list(A.id);
    check("B no puede listar la carpeta de A", (list.data?.length ?? 0) === 0);
    const signed = await B.c.storage.from("documents").createSignedUrl(aPath, 60);
    check("B no puede crear un enlace firmado a un archivo de A", !!signed.error || !signed.data?.signedUrl);
    const rm = await B.c.storage.from("documents").remove([aPath]);
    const stillThere = await A.c.storage.from("documents").download(aPath);
    check("B no puede borrar archivos de A", !!stillThere.data, rm.error?.message ?? "");
    const real = await admin.from("lab_files").select("storage_path").limit(1);
    if (real.data?.[0]) {
      const p = real.data[0].storage_path as string;
      const r1 = await B.c.storage.from("documents").download(p);
      const r2 = await B.c.storage.from("documents").createSignedUrl(p, 60);
      check("B no accede a un archivo real de otro usuario (descarga ni enlace firmado)", !r1.data && (!!r2.error || !r2.data?.signedUrl));
    }
    const usage = await B.c.rpc("my_storage_usage");
    check("my_storage_usage solo cuenta lo propio (B no tiene archivos)", Number(usage.data?.files) === 0);

    // ── B no puede escribir en datos de A ──
    const spoof = await B.c.from("subjects").insert({ name: "Falsa", user_id: A.id });
    check("B no puede crear asignaturas a nombre de A", deniedBySecurity(spoof.error), spoof.error?.message.slice(0, 60));
    const lb = await B.c.from("labs").insert({ name: "Lab", subject_id: subj!.id });
    check("B no puede crear un laboratorio en una asignatura de A", deniedBySecurity(lb.error), lb.error?.message.slice(0, 60));
    await B.c.from("subjects").update({ name: "hackeada" }).eq("id", subj!.id);
    const mod = await A.c.from("subjects").select("name").eq("id", subj!.id).single();
    check("B no puede modificar datos de A", mod.data?.name === "Asignatura de A");
    await B.c.from("subjects").delete().eq("id", subj!.id);
    const del = await A.c.from("subjects").select("id").eq("id", subj!.id);
    check("B no puede borrar datos de A", (del.data?.length ?? 0) === 1);

    // ── Escrituras sin efecto contra datos reales: si RLS fallara, no cambian nada ──
    for (const t of TABLES.filter((x) => x !== "profiles")) {
      const row = await admin.from(t).select("id, created_at").limit(1);
      if (!row.data?.[0]?.created_at) continue;
      const r = await B.c.from(t).update({ created_at: row.data[0].created_at }).eq("id", row.data[0].id).select("id");
      check(`B no puede modificar filas reales de «${t}» (reescritura sin efecto)`, r.error != null || (r.data?.length ?? 0) === 0);
    }

    // ── Tablas que solo escribe el servidor: ni siquiera el dueño puede insertar ──
    for (const t of SERVER_ONLY) {
      const r = await A.c.from(t).insert({ user_id: A.id }).select("id");
      if (r.data?.length) await admin.from(t).delete().in("id", r.data.map((x: { id: string }) => x.id)); // limpieza si por error entró
      check(`El estudiante no puede insertar directamente en «${t}»`, deniedBySecurity(r.error) && !(r.data?.length), r.error?.message.slice(0, 60));
    }
    const evalFake = await A.c.from("evaluations").insert({ user_id: A.id, lab_id: lab!.id, grade_scale_max: 5, estimated_grade: 5, overall_percent: 100 });
    check("El estudiante no puede falsear una evaluación con nota", deniedBySecurity(evalFake.error), evalFake.error?.message.slice(0, 60));

    // ── Enlaces de revisión: el hash del token no es legible ──
    const tk = await B.c.from("review_links").select("token_hash").limit(1);
    const tkA = await A.c.from("review_links").select("token_hash").limit(1);
    check("Ningún estudiante puede leer token_hash de review_links", !!tk.error && !!tkA.error);

    // ── Funciones y topes ──
    const rpc = await B.c.rpc("reserve_ai_budget", { p_user: B.id, p_kind: "analisis", p_units: 1, p_user_limit: 1_000_000, p_global_limit: 1_000_000 });
    check("Un estudiante no puede ejecutar reserve_ai_budget", !!rpc.error);
    const lim = await B.c.from("app_limits").select("*");
    check("Un estudiante no puede leer ni cambiar app_limits", (lim.error != null || (lim.data?.length ?? 0) === 0));
    const limW = await B.c.from("app_limits").update({ value: 1 }).eq("key", "user_bytes").select("key");
    const limNow = await admin.from("app_limits").select("value").eq("key", "user_bytes").single();
    check("app_limits no cambió tras el intento de B", Number(limNow.data?.value) !== 1 && (limW.error != null || (limW.data?.length ?? 0) === 0));
  } finally {
    for (const f of cleanup.reverse()) await f().catch(() => undefined);
  }

  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${results.length} comprobaciones superadas`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
