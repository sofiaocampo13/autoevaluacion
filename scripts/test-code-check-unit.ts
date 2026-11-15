import assert from "node:assert/strict";
import type { EvidenceItem } from "../src/lib/evidence";
import { checkCodeEvidence } from "../src/lib/code-check";

const item = (location: string, code: string): EvidenceItem => ({
  location, ext: location.split(".").pop()!, origin: "archivo", bytes: code.length,
  ex: { mode: "text", parts: [], chars: code.length }, fullText: `[Archivo: ${location} · x]\n${code}`,
});
const nb = JSON.stringify({ cells: [{ cell_type: "code", source: ["%matplotlib inline\n", "import os\n", "def f(:\n", "  pass"] }, { cell_type: "code", source: ["print(dato_de_otra_celda)"] }] });

async function main() {
  const r = (await checkCodeEvidence([
    item("a/sano.py", "def suma(a, b):\n    return a + b\n"),
    item("a/roto.py", "def f(x:\n    return x\n"),
    item("a/markdown.py", "```python\nprint('hola')\n```\n"),
    item("a/indef.py", "def f():\n    return nombre_que_no_existe\n"),
    item("a/nb.ipynb", nb),
    item("a/malo.json", '{"a": 1,}'),
    item("a/datos.jsonl", '{"a":1}\n{"a":\n{"a":3}\n'),
    item("a/rota.js", "function f( {\n  return 1\n}\n"),
    item("a/ok.js", "export const x = () => 1;\n"),
    item("a/test_algo.py", "import unittest\nclass T(unittest.TestCase):\n    def test_a(self):\n        self.assertTrue(True)\n"),
    item("a/script_test.py", "import requests\nprint(requests.get('http://x'))\n"),
    item("a/Main.java", "class Main {}\n"),
  ]))!;
  const by = Object.fromEntries(r.files.map((f) => [f.location.split("/")[1], f]));
  let n = 0; const ok = (name: string, fn: () => void) => { fn(); n++; console.log("PASS ", name); };
  console.log("DEBUG pruebas detectadas:", JSON.stringify(r.tests), "| Java:", JSON.stringify(by["Main.java"]));
  ok("Python sano → ok", () => assert.equal(by["sano.py"].status, "ok"));
  ok("Python con error de sintaxis → con_errores", () => assert.equal(by["roto.py"].status, "con_errores"));
  ok("etiquetas Markdown dentro de .py → con_errores", () => assert.equal(by["markdown.py"].status, "con_errores"));
  ok("nombre indefinido → error", () => assert.ok(by["indef.py"].diagnostics.some((d) => d.code === "F821" && d.severity === "error")));
  ok("notebook: error de sintaxis en una celda, con su número; magia de Jupyter no es error", () => { const f = by["nb.ipynb"]; assert.equal(f.status, "con_errores"); assert.ok(f.diagnostics.some((d) => d.message.includes("(celda 1)"))); });
  ok("notebook: nombre de otra celda es solo aviso", () => { const d = by["nb.ipynb"].diagnostics.find((x) => x.message.includes("(celda 2)")); assert.equal(d?.severity, "warning"); });
  ok("JSON inválido → con_errores", () => assert.equal(by["malo.json"].status, "con_errores"));
  ok("JSONL: detecta la línea mala", () => { const d = by["datos.jsonl"].diagnostics; assert.equal(d.length, 1); assert.equal(d[0].line, 2); });
  ok("JavaScript roto → con_errores; válido → ok", () => { assert.equal(by["rota.js"].status, "con_errores"); assert.equal(by["ok.js"].status, "ok"); });
  ok("Java: no analizado y se dice", () => { assert.equal(by["Main.java"].status, "no_analizado"); assert.ok(by["Main.java"].note); });
  ok("prueba unitaria real detectada; script *_test.py sin framework NO", () => { assert.deepEqual(r.tests.files, ["a/test_algo.py"]); assert.ok(r.tests.frameworks.includes("unittest")); });
  ok("siempre declara que no se ejecutó nada", () => { assert.equal(r.tests.executed, false); assert.ok(r.limitations[0].includes("NO se ejecutó")); });
  console.log(`\n${n}/12 pruebas superadas`);
}
main().catch((e) => { console.error("FALLÓ:", e.message); process.exit(1); });
