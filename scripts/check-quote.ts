import { createClient } from "@supabase/supabase-js";
import { quoteInText } from "../src/lib/assessment";
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  for (const [file, quote] of [
    ["preprocessing.py", 'def train_test_split_temporal(df, test_ratio=0.2):\n    split_idx = int(len(df) * (1 - test_ratio))\n    train_df = df.iloc[:split_idx].copy()'],
    ["model.py", 'class TemporalBaseline:\n    def predict(self, X_test):\n        return X_test["temp_lag1"].values'],
  ] as const) {
    const { data: f } = await sb.from("lab_files").select("storage_path").eq("file_name", file).limit(1).single();
    const { data } = await sb.storage.from("documents").download(f!.storage_path);
    const text = await data!.text();
    console.log(`--- ${file} (${text.length} caracteres) ---`);
    console.log(text.split("\n").filter((l) => /def |class |split|return X_test|lag1/.test(l)).slice(0, 8).join("\n"));
    console.log("¿la cita aparece?", quoteInText(quote, text));
  }
}
main().catch((e) => console.error("FALLÓ", e.message));
