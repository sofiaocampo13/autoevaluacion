import { Document, Page, Text, View, StyleSheet, renderToBuffer, type TextProps } from "@react-pdf/renderer";
import { GRADE_DISCLAIMER } from "./scoring";
import type { ReportData } from "./report-data";

// Las fuentes estándar de PDF solo cubren Latin-1: se sustituyen o quitan los símbolos que no existen en ellas.
const REPLACE: Record<string, string> = { "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "✓": "OK", "✗": "x", "▸": "-", "−": "-", "–": "-", "—": "-", "’": "'", "‘": "'", "“": '"', "”": '"', "…": "...", "·": "·" };
export const pdfSafe = (s: string) =>
  [...(s ?? "")].map((ch) => (REPLACE[ch] ?? (ch.codePointAt(0)! <= 255 || ch === "\n" ? ch : ""))).join("");

// Paleta del diseño: ciruela en la portada, violeta como color principal, rosado de acento y bordes lavanda.
const C = { plum: "#1F1633", brand: "#6D3FD9", brandLight: "#EFE8FF", slate: "#221A35", muted: "#5A5170", line: "#ECE6F5", bg: "#FAF7FD", accent: "#C2306E" };
const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, color: C.slate, lineHeight: 1.4 },
  cover: { backgroundColor: C.plum, color: "white", padding: 18, borderRadius: 6, marginBottom: 14 },
  coverKicker: { fontSize: 8, color: "#B9A2FF", letterSpacing: 1 },
  coverTitle: { fontSize: 17, fontFamily: "Helvetica-Bold", marginTop: 4, marginBottom: 5 },
  coverSub: { fontSize: 10, color: "#F4EEFF", marginTop: 2 },
  coverStats: { flexDirection: "row", marginTop: 12 },
  stat: { marginRight: 28 },
  statLabel: { fontSize: 7.5, color: "#B9A2FF" },
  statValue: { fontSize: 22, fontFamily: "Helvetica-Bold" },
  disclaimer: { backgroundColor: C.bg, borderLeft: `3 solid ${C.accent}`, padding: 8, marginBottom: 12, fontSize: 8.5, color: C.slate },
  h1: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.brand, marginTop: 12, marginBottom: 5, paddingBottom: 3, borderBottom: `1 solid ${C.line}` },
  h2: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 2 },
  p: { marginBottom: 4 },
  small: { fontSize: 8, color: C.muted },
  li: { flexDirection: "row", marginBottom: 2 },
  bullet: { width: 10 },
  liText: { flex: 1 },
  table: { borderTop: `1 solid ${C.line}`, borderLeft: `1 solid ${C.line}`, marginBottom: 6 },
  tr: { flexDirection: "row" },
  th: { backgroundColor: C.brandLight, fontFamily: "Helvetica-Bold", padding: 4, borderRight: `1 solid ${C.line}`, borderBottom: `1 solid ${C.line}` },
  td: { padding: 4, borderRight: `1 solid ${C.line}`, borderBottom: `1 solid ${C.line}` },
  barTrack: { height: 8, backgroundColor: "#F1ECF8", borderRadius: 4, marginTop: 2, marginBottom: 6 },
  card: { backgroundColor: C.bg, padding: 7, borderRadius: 4, marginBottom: 5 },
  mono: { fontFamily: "Courier", fontSize: 8 },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted, borderTop: `1 solid ${C.line}`, paddingTop: 4 },
});

const EVIDENCE = { suficiente: "Suficiente", parcial: "Parcial", inexistente: "Inexistente" } as const;
const CITE = { verificada: "verificada en el archivo", no_verificable: "captura/PDF (no comprobable automáticamente)", invalida: "descartada (no coincide con los archivos)" } as const;

type PdfStyle = TextProps["style"];
const T = ({ children, style }: { children: React.ReactNode; style?: PdfStyle }) => <Text style={style}>{typeof children === "string" ? pdfSafe(children) : children}</Text>;

function Bullets({ items, empty }: { items: string[]; empty?: string }) {
  if (items.length === 0) return empty ? <T style={[s.p, s.small]}>{empty}</T> : null;
  return (
    <View>
      {items.map((it, i) => (
        <View key={i} style={s.li} wrap={false}>
          <Text style={s.bullet}>-</Text>
          <T style={s.liText}>{it}</T>
        </View>
      ))}
    </View>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <View>
      <T style={s.h1}>{`${n}. ${title}`}</T>
      {children}
    </View>
  );
}

function Table({ head, widths, rows }: { head: string[]; widths: number[]; rows: string[][] }) {
  return (
    <View style={s.table}>
      <View style={s.tr} wrap={false}>
        {head.map((h, i) => (
          <T key={i} style={[s.th, { width: `${widths[i]}%` }]}>{h}</T>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={s.tr} wrap={false}>
          {r.map((c, i) => (
            <T key={i} style={[s.td, { width: `${widths[i]}%` }]}>{c}</T>
          ))}
        </View>
      ))}
    </View>
  );
}

/** El nombre del criterio ya suele traer su número ("1. Mapa mental"): no se vuelve a numerar. */
const label = (c: { criterion: string }, i: number) => (/^\s*\d+[.)]\s/.test(c.criterion) ? c.criterion : `${i + 1}. ${c.criterion}`);

const fmtDate = (d: Date) => d.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });

function Issues({ title, items }: { title: string; items: { problema: string; por_que: string; como_corregir: string }[] }) {
  if (items.length === 0) return null;
  return (
    <View>
      <T style={s.h2}>{title}</T>
      {items.map((it, i) => (
        <View key={i} style={s.card} wrap={false}>
          <T style={{ fontFamily: "Helvetica-Bold" }}>{it.problema}</T>
          <T><Text style={{ fontFamily: "Helvetica-Bold" }}>Por qué: </Text>{it.por_que}</T>
          <T><Text style={{ fontFamily: "Helvetica-Bold" }}>Cómo corregirlo: </Text>{it.como_corregir}</T>
        </View>
      ))}
    </View>
  );
}


const REVIEW_TEXT = {
  preliminar: "PRELIMINAR - aún no ha sido revisada ni aprobada por un docente.",
  aprobada: "APROBADA por el docente.",
  ajustada: "APROBADA CON AJUSTES del docente.",
  devuelta: "DEVUELTA por el docente con comentarios; esta estimación no fue aprobada.",
} as const;

function ReviewBlock({ d }: { d: ReportData }) {
  const r = d.review;
  return (
    <View>
      <T style={[s.h2, { color: r.status === "aprobada" || r.status === "ajustada" ? "#047857" : C.slate }]}>{`Estado de la revisión docente: ${REVIEW_TEXT[r.status]}`}</T>
      {r.reviewer && <T style={s.p}>{`Revisó: ${r.reviewer}${r.at ? ` el ${fmtDate(r.at)}` : ""}.`}</T>}
      {r.finalGrade != null && (
        <T style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: "#047857" }}>{`Nota final tras la revisión: ${r.finalGrade} / ${d.scaleMax} (${r.finalPercent} %)`}</T>
      )}
      {r.adjustments.length > 0 && (
        <View style={{ marginTop: 4 }}>
          <T style={s.h2}>Ajustes realizados por el docente</T>
          <Table
            head={["Criterio", "IA", "Docente", "Justificación"]}
            widths={[30, 10, 12, 48]}
            rows={r.adjustments.map((a) => [a.criterion, `${a.original_percent} %`, `${a.adjusted_percent} %`, a.justification])}
          />
        </View>
      )}
      {r.comment ? <T style={s.p}>{`Comentario del docente: ${r.comment}`}</T> : null}
    </View>
  );
}

export function ReportDocument({ d }: { d: ReportData }) {
  const issuesCount = d.feedback.errores_conceptuales.length + d.feedback.errores_tecnicos.length + d.feedback.procedimientos_incorrectos.length;
  const citedFiles = new Map<string, number>();
  d.criteria.forEach((c) => c.citations.filter((x) => x.status !== "invalida").forEach((x) => citedFiles.set(x.location, (citedFiles.get(x.location) ?? 0) + 1)));
  const objectives = d.labObjectives.trim() ? [d.labObjectives.trim()] : d.summary.objetivos_identificados;

  return (
    <Document title={pdfSafe(`Informe - ${d.labName}`)} author="Plataforma de autoevaluación académica" subject="Informe individual de autoevaluación (estimación orientativa)">
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          <T style={s.coverKicker}>INFORME INDIVIDUAL DE AUTOEVALUACIÓN ACADÉMICA</T>
          <T style={s.coverTitle}>{d.labName}</T>
          <T style={s.coverSub}>{`${d.student} - ${fmtDate(d.evaluatedAt)}`}</T>
          <View style={s.coverStats}>
            <View style={s.stat}>
              <T style={s.statLabel}>Calificación orientativa</T>
              <T style={s.statValue}>{`${d.grade} / ${d.scaleMax}`}</T>
            </View>
            <View style={s.stat}>
              <T style={s.statLabel}>Cumplimiento global</T>
              <T style={s.statValue}>{`${d.overallPercent} %`}</T>
            </View>
          </View>
        </View>
        <T style={s.disclaimer}>{GRADE_DISCLAIMER}</T>

        <Section n={1} title="Nombre del estudiante"><T style={s.p}>{d.student}</T></Section>
        <Section n={2} title="Nombre del laboratorio"><T style={s.p}>{d.labName}</T></Section>
        <Section n={3} title="Fecha de evaluación"><T style={s.p}>{fmtDate(d.evaluatedAt)}</T></Section>

        <Section n={4} title="Descripción de la actividad">
          <T style={s.p}>{d.labDescription.trim() || "No se registró una descripción del laboratorio."}</T>
          <T style={s.h2}>Objetivos</T>
          <Bullets items={objectives} empty="No se registraron objetivos." />
        </Section>

        <Section n={5} title="Materiales de referencia utilizados">
          <Bullets
            items={[
              `Rúbrica: ${d.materials.rubric}`,
              d.materials.guide ? `Guía o instrucciones: ${d.materials.guide}` : "Guía o instrucciones: no se asoció un documento específico",
              d.materials.repo ? `Repositorio de código: ${d.materials.repo}` : "",
              `Archivos del trabajo analizados: ${d.materials.filesAnalyzed}`,
            ].filter(Boolean)}
          />
        </Section>

        <Section n={6} title="Rúbrica aplicada">
          <T style={s.p}>{`${d.rubric.title || "Rúbrica del laboratorio"} - versión ${d.rubric.version} (confirmada y bloqueada antes de evaluar). Escala de calificación: 0 a ${d.scaleMax}. Criterios: ${d.criteria.length}.`}</T>
        </Section>

        <Section n={7} title="Criterios evaluados">
          <Table head={["Criterio", "Competencia", "Peso"]} widths={[62, 26, 12]} rows={d.criteria.map((c) => [c.criterion, c.competency || "-", `${c.weight} %`])} />
        </Section>

        <Section n={8} title="Evidencias encontradas">
          {d.criteria.map((c, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <T style={s.h2}>{label(c, i)}</T>
              {c.citations.length === 0 ? (
                <T style={[s.p, s.small]}>No se citaron evidencias.</T>
              ) : (
                c.citations.map((x, k) => (
                  <View key={k} style={s.card} wrap={false}>
                    <T style={s.small}>{`${x.location} - ${CITE[x.status]}`}</T>
                    <T style={s.mono}>{x.quote.length > 260 ? `${x.quote.slice(0, 260)}...` : x.quote}</T>
                  </View>
                ))
              )}
            </View>
          ))}
        </Section>

        <Section n={9} title="Referencias a páginas, secciones o archivos">
          <T style={s.p}>{`Se analizaron ${d.inventory.analyzed} de ${d.inventory.total} archivos del trabajo. Archivos citados como evidencia:`}</T>
          <Bullets items={[...citedFiles.entries()].map(([loc, n]) => `${loc} (${n} cita${n > 1 ? "s" : ""})`)} empty="Ningún archivo fue citado." />
          {d.inventory.skipped.length > 0 && (
            <T style={[s.p, s.small]}>{`No analizados u omitidos (${d.inventory.skipped.length}): ${d.inventory.skipped.slice(0, 8).map((x) => x.location).join(", ")}${d.inventory.skipped.length > 8 ? "..." : ""}`}</T>
          )}
        </Section>

        <Section n={10} title="Validación del cumplimiento">
          <Table
            head={["Criterio", "Evidencia", "Confianza", "Citas verificadas", "No comprobables", "Descartadas"]}
            widths={[34, 14, 12, 14, 14, 12]}
            rows={d.criteria.map((c) => [
              c.criterion,
              EVIDENCE[c.evidence],
              c.confidence,
              String(c.citations.filter((x) => x.status === "verificada").length),
              String(c.citations.filter((x) => x.status === "no_verificable").length),
              String(c.citations.filter((x) => x.status === "invalida").length),
            ])}
          />
          <T style={s.small}>Verificada: la cita existe literalmente en el archivo. No comprobable: captura o PDF, cuyo contenido el sistema no puede contrastar. Descartada: no coincide con los archivos y no cuenta como evidencia.</T>
        </Section>

        <Section n={11} title="Argumentación de cada valoración">
          {d.criteria.map((c, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <T style={s.h2}>{`${label(c, i)} - nivel ${c.rubricLevel}, ${c.percent} %`}</T>
              <T style={s.p}>{c.argumentation}</T>
              {c.warnings.map((w, k) => <T key={k} style={[s.p, { color: "#8A4B00" }]}>{`Aviso: ${w}`}</T>)}
              {c.notes.map((w, k) => <T key={k} style={[s.p, s.small]}>{`Nota: ${w}`}</T>)}
            </View>
          ))}
        </Section>

        <Section n={12} title="Calificación por criterio">
          <Table
            head={["Criterio", "Peso", "Nivel", "Porcentaje", "Aporte al global"]}
            widths={[40, 10, 18, 14, 18]}
            rows={d.criteria.map((c) => [c.criterion, `${c.weight} %`, c.rubricLevel, `${c.percent} %`, `${c.contribution} pts`])}
          />
          {d.criteria.map((c, i) => (
            <View key={i} wrap={false}>
              <T style={s.small}>{`${c.criterion} - ${c.percent} %`}</T>
              <View style={s.barTrack}>
                <View style={{ height: 8, borderRadius: 4, width: `${Math.min(100, Math.max(0, c.percent))}%`, backgroundColor: C.brand }} />
              </View>
            </View>
          ))}
        </Section>

        <Section n={13} title="Porcentaje de cumplimiento">
          <T style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: C.brand }}>{`${d.overallPercent} %`}</T>
          <T style={[s.p, s.small]}>Calculado por el sistema (no por la IA) como la suma de peso x porcentaje de cada criterio, según las ponderaciones de la rúbrica confirmada.</T>
        </Section>

        <Section n={14} title="Nota final orientativa">
          <T style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: C.brand }}>{`${d.grade} / ${d.scaleMax}`}</T>
          <T style={[s.p, { marginTop: 4 }]}>{GRADE_DISCLAIMER}</T>
          <ReviewBlock d={d} />
        </Section>

        <Section n={15} title="Fortalezas">
          <Bullets items={d.summary.fortalezas} empty="No se identificaron fortalezas específicas." />
          {d.concepts.demostrado.length > 0 && <T style={[s.p, s.small]}>{`Conceptos demostrados: ${d.concepts.demostrado.join(", ")}.`}</T>}
        </Section>

        <Section n={16} title="Errores identificados">
          {issuesCount === 0 && <T style={[s.p, s.small]}>No se identificaron errores conceptuales, técnicos ni procedimientos incorrectos concretos.</T>}
          <Issues title="Errores conceptuales" items={d.feedback.errores_conceptuales} />
          <Issues title="Errores técnicos" items={d.feedback.errores_tecnicos} />
          <Issues title="Procedimientos incorrectos" items={d.feedback.procedimientos_incorrectos} />
        </Section>

        <Section n={17} title="Aspectos incompletos">
          <Issues title="Aspectos incompletos" items={d.feedback.aspectos_incompletos} />
          {d.feedback.criterios_no_cumplidos.length > 0 && (<><T style={s.h2}>Criterios no cumplidos</T><Bullets items={d.feedback.criterios_no_cumplidos} /></>)}
          {d.concepts.refuerzo.length > 0 && (<><T style={s.h2}>Conceptos que requieren refuerzo</T><Bullets items={d.concepts.refuerzo} /></>)}
          {d.feedback.aspectos_incompletos.length + d.feedback.criterios_no_cumplidos.length + d.concepts.refuerzo.length === 0 && (
            <T style={[s.p, s.small]}>No se identificaron aspectos incompletos.</T>
          )}
        </Section>

        <Section n={18} title="Recomendaciones">
          <Bullets items={d.feedback.recomendaciones} empty="No hay recomendaciones generales." />
          <T style={s.h2}>Recomendaciones por criterio</T>
          <Bullets items={d.criteria.filter((c) => c.recommendation).map((c) => `${c.criterion}: ${c.recommendation}`)} empty="Sin recomendaciones por criterio." />
        </Section>

        <Section n={19} title="Retroalimentación general">
          <T style={s.p}>{d.summary.resumen}</T>
          <T style={s.p}><Text style={{ fontFamily: "Helvetica-Bold" }}>Calidad del desarrollo: </Text>{pdfSafe(d.summary.calidad_desarrollo)}</T>
          <T style={s.p}><Text style={{ fontFamily: "Helvetica-Bold" }}>Coherencia de los resultados: </Text>{pdfSafe(d.summary.coherencia_resultados)}</T>
          {d.summary.debilidades.length > 0 && (<><T style={s.h2}>Debilidades</T><Bullets items={d.summary.debilidades} /></>)}
        </Section>

        <Section n={20} title="Limitaciones del análisis">
          <T style={s.p}>{d.limitations || "No se registraron limitaciones."}</T>
          {d.code && (
            <View>
              <T style={s.h2}>Verificación técnica del código</T>
              <T style={s.p}>{`Archivos analizados: ${d.code.summary.analyzed}. Con errores: ${d.code.summary.withErrors}. Errores: ${d.code.summary.errors}. Avisos: ${d.code.summary.warnings}. Herramientas: ${d.code.analyzers.join(", ") || "ninguna"}. Pruebas unitarias: ${d.code.tests.files.length ? `${d.code.tests.files.length} archivo(s), no ejecutados` : "no se detectaron"}.`}</T>
              <Bullets items={d.code.limitations} />
            </View>
          )}
          <T style={s.h2}>Trazabilidad</T>
          <T style={[s.p, s.small]}>{`Proveedor y modelo de IA: ${d.trace.provider} / ${d.trace.model}. Versión de los prompts: ${d.trace.promptVersion}. Rúbrica: versión ${d.rubric.version}.`}</T>
        </Section>

        <View style={s.footer} fixed>
          <T>Estimación orientativa generada con IA. No es una calificación oficial.</T>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(d: ReportData): Promise<Buffer> {
  return renderToBuffer(<ReportDocument d={d} />);
}
