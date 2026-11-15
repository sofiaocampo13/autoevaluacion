import { Workspace, PositionEncoding } from "@astral-sh/ruff-wasm-nodejs";
const t0 = Date.now();
const ws = new Workspace({ "line-length": 100, lint: { select: ["E9", "F"] } }, PositionEncoding.Utf16);
console.log("versión ruff:", Workspace.version(), "· inicializa en", Date.now() - t0, "ms");
const casos = {
  "sano": "import os\n\ndef suma(a, b):\n    return a + b\n",
  "error de sintaxis": "def f(x:\n    return x + 1\n",
  "etiquetas Markdown dentro del .py": "```python\nprint('hola')\n```\n",
  "import sin usar + nombre indefinido": "import os, sys\n\ndef f():\n    return variable_que_no_existe\n",
  "cadena sin cerrar": "x = 'hola\nprint(x)\n",
};
for (const [nombre, codigo] of Object.entries(casos)) {
  const t = Date.now();
  const d = ws.check(codigo);
  console.log(`\n${nombre} (${Date.now() - t} ms) → ${d.length} diagnóstico(s)`);
  d.slice(0, 4).forEach((x) => console.log(`   [${x.code ?? "SINTAXIS"}] línea ${x.start_location.row}: ${x.message}`));
}
