"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { countNodes, onlyStrengths, type MindNode, type MindState } from "@/lib/mindmap-data";

const NODE_W = 230;
const NODE_H = 30;
const COL = 270;
const ROW = 40;
const PAD = 24;

// Colores como atributos (no clases) para que el SVG descargado se vea igual fuera de la aplicación.
const PALETTE: Record<MindState, { fill: string; stroke: string; text: string; glyph: string; dash?: string; name: string }> = {
  demostrado: { fill: "#dcfce7", stroke: "#16a34a", text: "#14532d", glyph: "✓", name: "demostrado" },
  parcial: { fill: "#fefce8", stroke: "#ca8a04", text: "#713f12", glyph: "◐", name: "parcial" },
  refuerzo: { fill: "#ffedd5", stroke: "#ea580c", text: "#7c2d12", glyph: "↗", name: "por reforzar" },
  sin_evaluar: { fill: "#f1f5f9", stroke: "#94a3b8", text: "#475569", glyph: "–", dash: "4 3", name: "sin evaluar" },
  neutro: { fill: "#f8fafc", stroke: "#64748b", text: "#1e293b", glyph: "", name: "" },
};
const KIND: Record<MindNode["kind"], string> = {
  root: "Asignatura",
  branch: "Rama",
  cut: "Corte",
  lab: "Laboratorio",
  criterion: "Criterio",
  theme: "Tema",
  subtheme: "Subtema",
  concept: "Concepto",
  gap: "Por profundizar",
  action: "Acción del plan",
  pending: "Sin evaluar",
};

type Laid = { n: MindNode; x: number; y: number; depth: number };

function layout(root: MindNode, expanded: Set<string>) {
  const nodes: Laid[] = [];
  const edges: [Laid, Laid][] = [];
  let row = 0;
  const place = (n: MindNode, depth: number): Laid => {
    const kids = expanded.has(n.id) ? n.children : [];
    const l: Laid = { n, x: depth * COL, y: 0, depth };
    if (kids.length === 0) l.y = row++ * ROW;
    else {
      const placed = kids.map((k) => place(k, depth + 1));
      placed.forEach((p) => edges.push([l, p]));
      l.y = (placed[0].y + placed[placed.length - 1].y) / 2;
    }
    nodes.push(l);
    return l;
  };
  place(root, 0);
  const maxX = Math.max(...nodes.map((l) => l.x)) + NODE_W;
  const maxY = Math.max(...nodes.map((l) => l.y)) + NODE_H;
  return { nodes, edges, width: maxX + PAD * 2, height: maxY + PAD * 2 };
}

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);
const initialExpanded = (root: MindNode) => new Set([root.id, ...root.children.map((c) => c.id)]);
const allIds = (n: MindNode): string[] => [n.id, ...n.children.flatMap(allIds)];

const findNode = (n: MindNode, id: string): MindNode | undefined => (n.id === id ? n : n.children.map((c) => findNode(c, id)).find(Boolean));

export function MindMapView({ root: full }: { root: MindNode }) {
  const [strengthsOnly, setStrengthsOnly] = useState(false);
  const root = useMemo(() => (strengthsOnly ? (onlyStrengths(full) ?? full) : full), [full, strengthsOnly]);
  const hidden = countNodes(full) - countNodes(root);
  const [expanded, setExpanded] = useState<Set<string>>(() => initialExpanded(full));
  const [picked, setSelected] = useState<MindNode>(full);
  const selected = findNode(root, picked.id) ?? root;
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const lay = useMemo(() => layout(root, expanded), [root, expanded]);

  const fit = useCallback(() => {
    const w = wrap.current?.clientWidth ?? 800;
    const h = wrap.current?.clientHeight ?? 600;
    const k = Math.min(1, w / lay.width, h / lay.height);
    setView({ k, x: (w - lay.width * k) / 2 + PAD * k, y: Math.max(8, (h - lay.height * k) / 2) + PAD * k });
  }, [lay.width, lay.height]);

  useEffect(() => {
    fit();
    // Solo al montar y al cambiar el tamaño del árbol visible: no se recentra mientras el usuario arrastra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, root]);

  // Zoom con la rueda (el listener debe ser no pasivo para poder evitar que la página se desplace).
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => {
        const k = Math.min(3, Math.max(0.2, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const zoomBy = (f: number) => {
    const w = wrap.current?.clientWidth ?? 800;
    const h = wrap.current?.clientHeight ?? 600;
    setView((v) => {
      const k = Math.min(3, Math.max(0.2, v.k * f));
      return { k, x: w / 2 - ((w / 2 - v.x) / v.k) * k, y: h / 2 - ((h / 2 - v.y) / v.k) * k };
    });
  };

  /** SVG autónomo del árbol visible completo (sin el zoom/desplazamiento actual). */
  function standaloneSvg(): string {
    const el = svg.current;
    if (!el) return "";
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll("[data-ui]").forEach((n) => n.remove());
    const g = clone.querySelector("g[data-zoom]") as SVGGElement | null;
    g?.setAttribute("transform", `translate(${PAD},${PAD})`);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("viewBox", `0 0 ${lay.width} ${lay.height}`);
    clone.setAttribute("width", String(lay.width));
    clone.setAttribute("height", String(lay.height));
    clone.removeAttribute("class");
    clone.removeAttribute("style");
    clone.setAttribute("font-family", "Arial, Helvetica, sans-serif");
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "#ffffff");
    clone.insertBefore(bg, clone.firstChild);
    return new XMLSerializer().serializeToString(clone);
  }

  function save(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const downloadSvg = () => save(new Blob([standaloneSvg()], { type: "image/svg+xml;charset=utf-8" }), "mapa-mental.svg");
  function downloadPng() {
    const scale = Math.min(2, 8000 / Math.max(lay.width, lay.height));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = Math.round(lay.width * scale);
      c.height = Math.round(lay.height * scale);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => b && save(b, "mapa-mental.png"), "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(standaloneSvg());
  }

  const btn = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-slate-500";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button className={btn} onClick={() => setExpanded(new Set(allIds(root)))}>Expandir todo</button>
          <button className={btn} onClick={() => setExpanded(initialExpanded(root))}>Contraer</button>
          <button className={btn} onClick={() => zoomBy(1.25)} aria-label="Acercar">＋</button>
          <button className={btn} onClick={() => zoomBy(0.8)} aria-label="Alejar">－</button>
          <button className={btn} onClick={fit}>Ajustar</button>
          <span className="mx-1 h-5 w-px bg-slate-300" />
          <div role="group" aria-label="Qué mostrar" className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">
            <button aria-pressed={!strengthsOnly} onClick={() => setStrengthsOnly(false)} className={`px-3 py-1.5 ${!strengthsOnly ? "bg-slate-800 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>Todo</button>
            <button aria-pressed={strengthsOnly} onClick={() => setStrengthsOnly(true)} className={`px-3 py-1.5 ${strengthsOnly ? "bg-slate-800 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>Solo fortalezas</button>
          </div>
          <span className="mx-1 h-5 w-px bg-slate-300" />
          <button className={btn} onClick={downloadPng}>Descargar PNG</button>
          <button className={btn} onClick={downloadSvg}>Descargar SVG</button>
        </div>

        <div
          ref={wrap}
          className="h-[34rem] cursor-grab touch-none overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 active:cursor-grabbing"
          onPointerDown={(e) => {
            if ((e.target as Element).closest("[data-node]")) return;
            drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (d) setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
          }}
          onPointerUp={() => (drag.current = null)}
        >
          <svg ref={svg} width="100%" height="100%" role="group" aria-label="Mapa mental del semestre">
            <g data-zoom transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
              {lay.edges.map(([a, b], i) => {
                const x1 = a.x + NODE_W;
                const y1 = a.y + NODE_H / 2;
                const x2 = b.x;
                const y2 = b.y + NODE_H / 2;
                const mx = (x1 + x2) / 2;
                return <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="#cbd5e1" strokeWidth={1.5} />;
              })}
              {lay.nodes.map(({ n, x, y }) => {
                const p = PALETTE[n.kind === "root" ? "neutro" : n.state];
                const root = n.kind === "root";
                const isSel = selected.id === n.id;
                const open = expanded.has(n.id);
                const pct = n.percent != null ? `${n.percent} %` : "";
                const label = `${p.glyph ? p.glyph + " " : ""}${clip(n.label, pct ? 22 : 28)}`;
                return (
                  <g key={n.id} data-node>
                    <g
                      role="button"
                      tabIndex={0}
                      aria-label={`${KIND[n.kind]}: ${n.label}${p.name ? `, ${p.name}` : ""}${pct ? `, ${pct}` : ""}${n.stats?.weak ? `, contiene ${n.stats.weak} por reforzar` : ""}`}
                      style={{ cursor: "pointer", outline: "none" }}
                      onClick={() => setSelected(n)}
                      onDoubleClick={() => n.children.length && toggle(n.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSelected(n);
                        if (e.key === " ") {
                          e.preventDefault();
                          if (n.children.length) toggle(n.id);
                        }
                      }}
                    >
                      <title>{n.label}</title>
                      <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={8} fill={root ? "#1e293b" : p.fill} stroke={isSel ? "#0f172a" : p.stroke} strokeWidth={isSel ? 3 : 1.5} strokeDasharray={p.dash} />
                      <text x={x + 10} y={y + 19} fontSize={12.5} fontWeight={root || n.kind === "branch" ? 700 : 500} fill={root ? "#ffffff" : p.text}>{label}</text>
                      {pct && <text x={x + NODE_W - 10} y={y + 19} fontSize={12} textAnchor="end" fill={root ? "#e2e8f0" : p.text}>{pct}</text>}
                      {n.stats && n.stats.weak > 0 && !open && (
                        <g>
                          <circle cx={x} cy={y} r={9} fill={PALETTE.refuerzo.stroke} stroke="#ffffff" strokeWidth={1.5} />
                          <text x={x} y={y + 3.5} fontSize={10} fontWeight={700} textAnchor="middle" fill="#ffffff">{n.stats.weak}</text>
                        </g>
                      )}
                    </g>
                    {n.children.length > 0 && (
                      <g
                        data-ui
                        role="button"
                        tabIndex={0}
                        aria-label={`${open ? "Contraer" : "Expandir"} ${n.label}`}
                        aria-expanded={open}
                        style={{ cursor: "pointer", outline: "none" }}
                        onClick={() => toggle(n.id)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(n.id))}
                      >
                        <circle cx={x + NODE_W + 12} cy={y + NODE_H / 2} r={10} fill="#ffffff" stroke="#64748b" strokeWidth={1.5} />
                        <text x={x + NODE_W + 12} y={y + NODE_H / 2 + 4} fontSize={open ? 14 : 10} textAnchor="middle" fill="#334155">{open ? "−" : n.children.length}</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Leyenda">
          {(["demostrado", "parcial", "refuerzo", "sin_evaluar"] as MindState[]).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded" style={{ background: PALETTE[s].fill, border: `1.5px ${PALETTE[s].dash ? "dashed" : "solid"} ${PALETTE[s].stroke}` }} />
              {PALETTE[s].glyph} {PALETTE[s].name}
            </li>
          ))}
          <li>El color de una rama resume a la mayoría de lo que contiene; el círculo naranja con número indica cuántos elementos por reforzar tiene dentro (ábrela para verlos).</li>
        </ul>
        {strengthsOnly && (
          <p className="mt-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-900 ring-1 ring-amber-200">
            Vista parcial: se ocultan {hidden} nodos (lo parcial, lo por reforzar, lo sin evaluar y el plan). Los porcentajes de laboratorios y cortes siguen siendo los reales. Vuelve a «Todo» para ver también qué profundizar.
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500">Arrastra para mover, rueda para acercar. Clic en un nodo: detalle. Botón redondo o barra espaciadora: expandir y contraer.</p>
      </div>

      <aside className="rounded-xl bg-white p-4 ring-1 ring-slate-200 lg:max-h-[38rem] lg:overflow-y-auto" aria-live="polite">
        <p className="text-xs uppercase tracking-wide text-slate-500">{KIND[selected.kind]}</p>
        <h2 className="mt-0.5 text-base font-semibold text-slate-900">{selected.detail.title}</h2>
        <p className="mt-1 text-sm">
          {PALETTE[selected.state].name && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: PALETTE[selected.state].fill, color: PALETTE[selected.state].text, border: `1px solid ${PALETTE[selected.state].stroke}` }}>
              {PALETTE[selected.state].glyph} {PALETTE[selected.state].name}
            </span>
          )}
        </p>
        {selected.stats && (
          <p className="mt-3 text-sm text-slate-700">
            {selected.stats.strong} de {selected.stats.total} {selected.stats.unit} demostrados
            {selected.stats.weak > 0 && <span className="font-medium text-orange-800"> · {selected.stats.weak} por reforzar</span>}
          </p>
        )}
        {selected.detail.lines.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {selected.detail.lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
        {selected.detail.deepen.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-900">Qué profundizar</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">{selected.detail.deepen.map((d, i) => <li key={i}>{d}</li>)}</ul>
          </div>
        )}
        {selected.detail.evidence.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-900">Evidencias citadas</p>
            <ul className="mt-1 space-y-2">
              {selected.detail.evidence.map((e, i) => (
                <li key={i} className="rounded-lg bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">{e.label}</p>
                  <p className="whitespace-pre-wrap break-words font-mono text-xs text-slate-800">{clip(e.text, 280)}</p>
                  <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ring-1 ${e.verified ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>
                    {e.verified ? "Verificada en el archivo" : "No verificable automáticamente"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {selected.children.length > 0 && !expanded.has(selected.id) && (
          <button className={btn + " mt-3"} onClick={() => toggle(selected.id)}>Expandir ({selected.children.length})</button>
        )}
        {selected.detail.link && <Link className="mt-3 block text-sm text-indigo-700 underline" href={selected.detail.link.href}>{selected.detail.link.text}</Link>}
      </aside>
    </div>
  );
}
