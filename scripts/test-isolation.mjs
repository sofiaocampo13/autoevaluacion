// Prueba de aislamiento entre usuarios (criterio de salida de la Fase 1).
// Uso: node --env-file=.env.local scripts/test-isolation.mjs
// Requiere: migración 0001 aplicada y "Confirm email" DESACTIVADO en Supabase
// (Authentication → Providers → Email) solo mientras corres esta prueba.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const stamp = Date.now();
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

async function newUser(tag) {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const email = `test-${tag}-${stamp}@mailinator.com`;
  const { data, error } = await c.auth.signUp({ email, password: "Prueba-12345", options: { data: { full_name: tag } } });
  if (error || !data.session) throw new Error(`No se pudo crear ${tag}: ${error?.message ?? "sin sesión (¿Confirm email activo?)"}`);
  return { c, id: data.user.id };
}

const A = await newUser("A");
const B = await newUser("B");

// A crea asignatura y un archivo
const { data: subj, error: e1 } = await A.c.from("subjects").insert({ name: "Asignatura de A", grade_scale_max: 5 }).select().single();
check("A puede crear su asignatura", !e1 && subj);
const { error: eUp } = await A.c.storage.from("documents").upload(`${A.id}/secreto.txt`, new Blob(["datos de A"]));
check("A puede subir a su carpeta", !eUp, eUp?.message);

// B no ve nada de A
const { data: seen } = await B.c.from("subjects").select("*");
check("B no ve asignaturas de A", seen.length === 0);
const { data: prof } = await B.c.from("profiles").select("id");
check("B solo ve su propio perfil", prof.length === 1 && prof[0].id === B.id);
const { data: dl } = await B.c.storage.from("documents").download(`${A.id}/secreto.txt`);
check("B no puede descargar archivos de A", !dl);
const { error: eUpB } = await B.c.storage.from("documents").upload(`${A.id}/intruso.txt`, new Blob(["x"]));
check("B no puede subir a la carpeta de A", !!eUpB);

// B no puede escribir en datos de A ni falsear dueño
const { error: eSpoof } = await B.c.from("subjects").insert({ name: "Falsa", user_id: A.id });
check("B no puede crear asignaturas a nombre de A", !!eSpoof);
const { error: eLab } = await B.c.from("labs").insert({ name: "Lab", subject_id: subj.id });
check("B no puede crear laboratorio en asignatura de A", !!eLab);
await B.c.from("subjects").update({ name: "hackeada" }).eq("id", subj.id);
const { data: still } = await A.c.from("subjects").select("name").eq("id", subj.id).single();
check("B no puede modificar datos de A", still.name === "Asignatura de A");

// Nadie puede falsear una evaluación
const { data: lab } = await A.c.from("labs").insert({ name: "Lab A", subject_id: subj.id }).select().single();
const { error: eEval } = await A.c
  .from("evaluations")
  .insert({ user_id: A.id, lab_id: lab.id, grade_scale_max: 5, estimated_grade: 5, overall_percent: 100 });
check("El estudiante no puede crear/falsear evaluaciones", !!eEval);

// Anónimo
const anon = createClient(url, key, { auth: { persistSession: false } });
const { data: anonRows, error: eAnon } = await anon.from("subjects").select("*");
check("Anónimo no lee asignaturas", !!eAnon || anonRows.length === 0);

console.log(`\n${results.filter(Boolean).length}/${results.length} comprobaciones superadas`);
console.log("Limpieza: borra los usuarios test-*@mailinator.com desde Authentication → Users.");
process.exit(results.every(Boolean) ? 0 : 1);
