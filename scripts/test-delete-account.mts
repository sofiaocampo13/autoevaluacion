// Prueba de «Eliminar mi cuenta y mis datos» contra la base real, con usuarios temporales (A se elimina, B debe quedar intacto).
// Sube 105 archivos de 1 KB en carpetas anidadas para ejercitar el borrado por lotes. Uso: node --env-file=.env.local --import tsx scripts/test-delete-account.mts
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { deleteUserData } from "../src/lib/delete-account";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const stamp = Date.now();
let n = 0;
const ok = async (name: string, fn: () => Promise<void>) => {
  await fn();
  n++;
  console.log("PASS ", name);
};

async function newUser(tag: string) {
  const email = `borrado-${tag}-${stamp}@example.test`;
  const password = "Prueba-" + crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("no se creó el usuario");
  const c = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  return { c, id: data.user.id };
}
const count = async (table: string, userId: string) => (await admin.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId)).count ?? 0;
const filesOf = async (prefix: string) => (await admin.storage.from("documents").list(prefix, { limit: 100 })).data?.length ?? 0;

async function main() {
  const A = await newUser("A");
  const B = await newUser("B");
  try {
    for (const U of [A, B]) {
      const { data: subj } = await U.c.from("subjects").insert({ name: "Asignatura", grade_scale_max: 5 }).select().single();
      const { data: lab } = await U.c.from("labs").insert({ name: "Lab", subject_id: subj!.id }).select().single();
      assert.ok(lab);
    }
    // A: 105 archivos en una carpeta (más de un lote de 100) y uno en otra carpeta; B: un archivo.
    const body = () => new Blob([new Uint8Array(1024).fill(97)], { type: "text/plain" });
    await Promise.all(Array.from({ length: 105 }, (_, i) => A.c.storage.from("documents").upload(`${A.id}/lab1/f${i}.txt`, body())));
    await A.c.storage.from("documents").upload(`${A.id}/otra/profunda/x.txt`, body());
    await B.c.storage.from("documents").upload(`${B.id}/lab1/b.txt`, body());

    await ok("antes de borrar, A tiene datos y archivos", async () => {
      assert.equal(await count("subjects", A.id), 1);
      assert.equal(await count("labs", A.id), 1);
      assert.equal(await filesOf(`${A.id}/lab1`), 100); // la primera página (hay 105)
    });

    await ok("eliminar la cuenta de A devuelve ok y cuenta sus archivos (106)", async () => {
      const r = await deleteUserData(admin, A.id);
      assert.deepEqual(r, { ok: true, files: 106 });
    });
    await ok("A ya no existe: usuario, perfil, datos y archivos eliminados", async () => {
      assert.ok((await admin.auth.admin.getUserById(A.id)).error, "el usuario debía desaparecer");
      assert.equal((await admin.from("profiles").select("id").eq("id", A.id)).data?.length, 0);
      assert.equal(await count("subjects", A.id), 0);
      assert.equal(await count("labs", A.id), 0);
      assert.equal(await filesOf(A.id), 0);
      assert.equal(await filesOf(`${A.id}/otra`), 0);
    });
    await ok("B queda intacto: usuario, datos y archivo", async () => {
      assert.ok(!(await admin.auth.admin.getUserById(B.id)).error);
      assert.equal(await count("subjects", B.id), 1);
      assert.equal(await count("labs", B.id), 1);
      assert.equal(await filesOf(`${B.id}/lab1`), 1);
    });
    await ok("borrar un usuario que no existe falla sin tocar nada a los demás", async () => {
      const r = await deleteUserData(admin, crypto.randomUUID());
      assert.equal(r.ok, false);
      assert.equal(await count("subjects", B.id), 1);
    });
  } finally {
    await deleteUserData(admin, B.id);
    await deleteUserData(admin, A.id).catch(() => undefined);
  }
  console.log(`\n${n} comprobaciones superadas`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
