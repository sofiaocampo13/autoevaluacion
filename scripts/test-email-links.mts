// Comprueba contra Supabase que los enlaces de correo por «token_hash» (que no dependen del navegador) funcionan:
// confirmación de registro (type=email) y recuperación de contraseña (type=recovery), y que un enlace sirve una sola vez.
// Crea usuarios temporales con la clave de servicio y los borra. Uso: node --env-file=.env.local --import tsx scripts/test-email-links.mts
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const fresh = () => createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const stamp = Date.now();
let n = 0;
const ok = async (name: string, fn: () => Promise<void>) => {
  await fn();
  n++;
  console.log("PASS ", name);
};

async function main() {
  const email = `enlaces-${stamp}@example.test`;
  const password = "Prueba-" + crypto.randomUUID();
  let userId = "";
  try {
    await ok("un registro sin confirmar no puede iniciar sesión", async () => {
      const link = await admin.auth.admin.generateLink({ type: "signup", email, password });
      assert.ifError(link.error);
      userId = link.data.user!.id;
      const login = await fresh().auth.signInWithPassword({ email, password });
      assert.equal(login.error?.code, "email_not_confirmed");
      (globalThis as Record<string, unknown>).signupHash = link.data.properties.hashed_token;
    });
    await ok("el enlace de confirmación (type=email) funciona desde un cliente NUEVO, sin el navegador original", async () => {
      const c = fresh(); // sin cookies ni verificador de código: como abrir el correo en otro dispositivo
      const r = await c.auth.verifyOtp({ token_hash: (globalThis as Record<string, unknown>).signupHash as string, type: "email" });
      assert.ifError(r.error);
      assert.ok(r.data.session, "debía crear una sesión");
      assert.ok(r.data.user?.email_confirmed_at, "el correo debía quedar confirmado");
    });
    await ok("el mismo enlace de confirmación no sirve una segunda vez", async () => {
      const r = await fresh().auth.verifyOtp({ token_hash: (globalThis as Record<string, unknown>).signupHash as string, type: "email" });
      assert.ok(r.error);
    });
    await ok("ya confirmado, puede iniciar sesión con su contraseña", async () => {
      const login = await fresh().auth.signInWithPassword({ email, password });
      assert.ifError(login.error);
    });
    await ok("el enlace de recuperación (type=recovery) funciona desde un cliente NUEVO y crea sesión", async () => {
      const link = await admin.auth.admin.generateLink({ type: "recovery", email });
      assert.ifError(link.error);
      const r = await fresh().auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "recovery" });
      assert.ifError(r.error);
      assert.ok(r.data.session);
    });
    await ok("un código inventado se rechaza", async () => {
      const r = await fresh().auth.verifyOtp({ token_hash: "x".repeat(40), type: "email" });
      assert.ok(r.error);
    });
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
  console.log(`\n${n} comprobaciones superadas`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
