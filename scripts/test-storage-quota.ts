// Prueba de los límites de almacenamiento contra la base real (requiere aplicar antes la migración 0009).
// Crea un usuario temporal y archivos de 1 KB, cambia un tope durante unos segundos y lo RESTAURA siempre; borra todo al terminar.
// Uso: node --env-file=.env.local --import tsx scripts/test-storage-quota.ts
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const client = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
let n = 0;
const ok = async (name: string, fn: () => Promise<void>) => {
  await fn();
  n++;
  console.log("PASS ", name);
};
const body = () => new Blob([new Uint8Array(1024).fill(97)], { type: "text/plain" });

async function setLimit(key: string, value: number) {
  const { error } = await admin.from("app_limits").update({ value }).eq("key", key);
  if (error) throw error;
}

async function main() {
  const email = `quota-test-${Date.now()}@example.test`;
  const password = "Prueba-" + crypto.randomUUID();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (cErr || !created.user) throw cErr ?? new Error("no se creó el usuario temporal");
  const uid = created.user.id;
  const { error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;

  const { data: original } = await admin.from("app_limits").select("key, value");
  const orig = Object.fromEntries((original ?? []).map((r) => [r.key, Number(r.value)]));
  const paths: string[] = [];
  const up = async () => {
    const path = `${uid}/test/${crypto.randomUUID()}.txt`;
    const r = await client.storage.from("documents").upload(path, body(), { contentType: "text/plain" });
    if (!r.error) paths.push(path);
    return r;
  };

  try {
    await ok("los topes se pueden leer con sesión y tienen los tres valores", async () => {
      const { data, error } = await client.rpc("storage_limits");
      assert.ifError(error);
      assert.deepEqual(Object.keys(data).sort(), ["total_bytes", "user_bytes", "user_files"]);
      assert.ok(Number(data.user_bytes) > 0 && Number(data.user_files) > 0 && Number(data.total_bytes) > Number(data.user_bytes));
    });
    await ok("un usuario nuevo parte de 0 archivos y 0 bytes (el consumo es solo el suyo)", async () => {
      const { data } = await client.rpc("my_storage_usage");
      assert.deepEqual([Number(data.bytes), Number(data.files)], [0, 0]);
    });
    await ok("dentro de los topes, subir un archivo funciona y se cuenta", async () => {
      assert.ifError((await up()).error);
      const { data } = await client.rpc("my_storage_usage");
      assert.deepEqual([Number(data.bytes), Number(data.files)], [1024, 1]);
    });
    await ok("la tabla de topes no es legible ni modificable por el usuario", async () => {
      const r = await client.from("app_limits").select("*");
      assert.ok(r.error || (r.data ?? []).length === 0);
      const w = await client.from("app_limits").update({ value: 999999999999 }).eq("key", "user_bytes");
      assert.ok(w.error || true);
      const { data } = await admin.from("app_limits").select("value").eq("key", "user_bytes").single();
      assert.equal(Number(data!.value), orig.user_bytes);
    });
    await ok("al alcanzar el tope de archivos del usuario, la subida se rechaza", async () => {
      await setLimit("user_files", 1);
      try {
        const r = await up();
        assert.ok(r.error, "debía rechazarse");
      } finally {
        await setLimit("user_files", orig.user_files);
      }
    });
    await ok("al alcanzar el tope de bytes del usuario, la subida se rechaza", async () => {
      await setLimit("user_bytes", 1024);
      try {
        assert.ok((await up()).error, "debía rechazarse");
      } finally {
        await setLimit("user_bytes", orig.user_bytes);
      }
    });
    await ok("al alcanzar el tope total de la plataforma, la subida se rechaza", async () => {
      await setLimit("total_bytes", 1);
      try {
        assert.ok((await up()).error, "debía rechazarse");
      } finally {
        await setLimit("total_bytes", orig.total_bytes);
      }
    });
    await ok("con los topes restaurados vuelve a funcionar", async () => {
      assert.ifError((await up()).error);
    });
    await ok("no se puede subir a la carpeta de otro usuario", async () => {
      const r = await client.storage.from("documents").upload(`${crypto.randomUUID()}/test/x.txt`, body());
      assert.ok(r.error);
    });
  } finally {
    for (const [k, v] of Object.entries(orig)) await admin.from("app_limits").update({ value: v }).eq("key", k);
    if (paths.length) await admin.storage.from("documents").remove(paths);
    await admin.auth.admin.deleteUser(uid);
    const { data: after } = await admin.from("app_limits").select("key, value");
    assert.deepEqual(Object.fromEntries((after ?? []).map((r) => [r.key, Number(r.value)])), orig, "los topes deben quedar como estaban");
  }
  console.log(`\n${n} comprobaciones superadas`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
