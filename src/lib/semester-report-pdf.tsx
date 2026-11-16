import { Document, Page, Text, View, StyleSheet, renderToBuffer, type TextProps } from "@react-pdf/renderer";
import { pdfSafe } from "./report-pdf";
import { GRADE_DISCLAIMER } from "./scoring";
import { BAND_LABEL, type SemesterStats } from "./semester-stats";
import type { LabDetail } from "./mindmap-data";
import type { SavedAnalysis } from "./run-semester";

export type SemesterReportData = {
  student: string;
  subject: string;
  period: string;
  generatedAt: Date;
  stats: SemesterStats;
  details: LabDetail[];
  analysis: SavedAnalysis | null;
  analysisCurrent: boolean;
};

// Paleta Prisma: ciruela en la portada, violeta como color principal, rosado de acento y bordes lavanda.
const C = { head: "#1F1633", headLight: "#EFE8FF", brand: "#6D3FD9", slate: "#221A35", muted: "#5A5170", line: "#ECE6F5", bg: "#FAF7FD", accent: "#C2306E" };
const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, color: C.slate, lineHeight: 1.4 },
  cover: { backgroundColor: C.head, color: "white", padding: 18, borderRadius: 6, marginBottom: 14 },
  coverKicker: { fontSize: 8, color: "#B9A2FF", letterSpacing: 1 },
  coverTitle: { fontSize: 17, fontFamily: "Helvetica-Bold", marginTop: 4, marginBottom: 5 },
  coverSub: { fontSize: 10, color: "#F4EEFF", marginTop: 2 },
  coverStats: { flexDirection: "row", marginTop: 12 },
  stat: { marginRight: 28 },
  statLabel: { fontSize: 7.5, color: "#B9A2FF" },
  statValue: { fontSize: 22, fontFamily: "Helvetica-Bold" },
  disclaimer: { backgroundColor: C.bg, borderLeft: `3 solid ${C.accent}`, padding: 8, marginBottom: 12, fontSize: 8.5 },
  h1: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.brand, marginTop: 12, marginBottom: 5, paddingBottom: 3, borderBottom: `1 solid ${C.line}` },
  h2: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 2 },
  p: { marginBottom: 4 },
  small: { fontSize: 8, color: C.muted },
  bold: { fontFamily: "Helvetica-Bold" },
  li: { flexDirection: "row", marginBottom: 2 },
  bullet: { width: 10 },
  liText: { flex: 1 },
  table: { borderTop: `1 solid ${C.line}`, borderLeft: `1 solid ${C.line}`, marginBottom: 6 },
  tr: { flexDirection: "row" },
  th: { backgroundColor: C.headLight, fontFamily: "Helvetica-Bold", padding: 4, borderRight: `1 solid ${C.line}`, borderBottom: `1 solid ${C.line}` },
  td: { padding: 4, borderRight: `1 solid ${C.line}`, borderBottom: `1 solid ${C.line}` },
  barTrack: { height: 8, backgroundColor: "#F1ECF8", borderRadius: 4, marginTop: 2, marginBottom: 6 },
  card: { backgroundColor: C.bg, padding: 7, borderRadius: 4, marginBottom: 5 },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted, borderTop: `1 solid ${C.line}`, paddingTop: 4 },
});

// Mismos umbrales que el mapa mental y la infografía: ≥85 demostrado, ≥70 parcial, resto por reforzar.
const EVIDENCE = { suficiente: "Suficiente", parcial: "Parcial", inexistente: "Inexistente" } as const;
const PRIORITY = { alta: "alta", media: "media", baja: "baja" } as const;
const fmtDate = (d: Date | string) => new Date(d).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });
const fmtDay = (d: string) => new Date(d).toLocaleDateString("es-CO", { dateStyle: "medium" });
const delta = (d: number | null) => (d == null ? "-" : `${d > 0 ? "+" : ""}${d} pts`);

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

function Bar({ label, percent }: { label: string; percent: number }) {
  return (
    <View wrap={false}>
      <T style={s.small}>{`${label} - ${percent} %`}</T>
      <View style={s.barTrack}>
        <View style={{ height: 8, borderRadius: 4, width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: C.brand }} />
      </View>
    </View>
  );
}

export function SemesterReportDocument({ d }: { d: SemesterReportData }) {
  const { stats, analysis } = d;
  const derived = stats.competencies.length > 0 && stats.competencies.every((c) => c.derived);
  const a = analysis?.analysis;
  const toReinforce = stats.concepts.filter((c) => c.current === "refuerzo");
  const counts = stats.concepts.reduce((acc, c) => ({ ...acc, [c.current]: acc[c.current] + 1 }), { demostrado: 0, parcial: 0, refuerzo: 0 });

  return (
    <Document title={pdfSafe(`Informe del semestre - ${d.subject}`)} author="Plataforma de autoevaluación académica" subject="Informe integrado del semestre (estimación orientativa)">
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          <T style={s.coverKicker}>INFORME INTEGRADO DEL SEMESTRE - AUTOEVALUACIÓN ACADÉMICA</T>
          <T style={s.coverTitle}>{d.subject}</T>
          <T style={s.coverSub}>{`${d.student}${d.period ? ` - ${d.period}` : ""} - ${fmtDate(d.generatedAt)}`}</T>
          <View style={s.coverStats}>
            <View style={s.stat}>
              <T style={s.statLabel}>Promedio orientativo</T>
              <T style={s.statValue}>{`${stats.averageGrade} / ${stats.scaleMax}`}</T>
            </View>
            <View style={s.stat}>
              <T style={s.statLabel}>Cumplimiento promedio</T>
              <T style={s.statValue}>{`${stats.averagePercent} %`}</T>
            </View>
            <View style={s.stat}>
              <T style={s.statLabel}>Laboratorios evaluados</T>
              <T style={s.statValue}>{`${stats.labsEvaluated} de ${stats.labsTotal}`}</T>
            </View>
          </View>
        </View>
        <T style={s.disclaimer}>{GRADE_DISCLAIMER} Las cifras de este informe las calcula el sistema a partir de tus evaluaciones; la IA solo redacta el diagnóstico y el plan.</T>

        <Section n={1} title="Resumen del semestre">
          <Bullets
            items={[
              `Laboratorios evaluados: ${stats.labsEvaluated} de ${stats.labsTotal}${stats.pendingLabs.length ? `. Sin evaluar (no entran en los promedios): ${stats.pendingLabs.join(", ")}` : ""}.`,
              `Notas revisadas por un docente: ${stats.reviewedLabs} de ${stats.labsEvaluated}. Para esos laboratorios cuenta la nota del docente; para el resto, la estimación de la IA.`,
              stats.trend ? `Evolución del primer al último laboratorio: ${stats.trend.first} % -> ${stats.trend.last} % (${delta(stats.trend.delta)}).` : "Con un solo laboratorio evaluado todavía no hay evolución que comparar.",
            ]}
          />
          {stats.labsEvaluated < 3 && <T style={[s.p, { color: "#8A4B00" }]}>{`Hay pocos laboratorios evaluados (${stats.labsEvaluated}): las tendencias y los patrones todavía no son concluyentes.`}</T>}
        </Section>

        <Section n={2} title="Valoración de cada laboratorio">
          <Table
            head={["Laboratorio", "Corte", "Nota", "Cumplimiento", "Nivel", "Revisión"]}
            widths={[32, 8, 12, 14, 16, 18]}
            rows={stats.points.map((p) => [p.name, p.cut ? String(p.cut) : "-", `${p.grade} / ${stats.scaleMax}`, `${p.percent} %`, BAND_LABEL[p.band], p.reviewed ? "Docente" : "Preliminar (IA)"])}
          />
          {stats.points.map((p) => (
            <Bar key={p.evaluationId} label={p.name} percent={p.percent} />
          ))}
          <T style={s.small}>Verde: 85 % o más. Amarillo: de 70 a 84 %. Naranja: menos de 70 %. Niveles propios de la plataforma (85 % dominio alto, 70 % competente, 50 % en desarrollo); no son los de la rúbrica de tu docente.</T>
          {stats.points.map((p) => {
            const det = d.details.find((x) => x.labId === p.labId);
            return (
              <View key={p.evaluationId} style={{ marginTop: 8 }}>
                <T style={s.h2}>{`${p.name} - ${p.grade} / ${stats.scaleMax} (${p.percent} %)`}</T>
                <T style={[s.p, s.small]}>{`Evaluado el ${fmtDay(p.date)}. ${p.reviewed ? `Nota revisada por un docente (estimación de la IA: ${p.aiPercent} %).` : "Nota preliminar, sin revisión docente."}`}</T>
                {det && det.criteria.length > 0 && (
                  <Table head={["Criterio", "Cumplimiento", "Evidencia"]} widths={[62, 18, 20]} rows={det.criteria.map((c) => [c.criterion, `${c.percent} %`, EVIDENCE[c.evidence]])} />
                )}
                {det && det.recommendations.length > 0 && (
                  <View>
                    <T style={[s.small, s.bold]}>Recomendaciones de la evaluación</T>
                    <Bullets items={det.recommendations.slice(0, 4)} />
                  </View>
                )}
              </View>
            );
          })}
        </Section>

        <Section n={3} title={derived ? "Cumplimiento por criterio de la rúbrica" : "Cumplimiento por competencia"}>
          {derived && <T style={[s.p, s.small]}>Tu rúbrica no define competencias, así que se muestran los criterios tal como aparecen en ella.</T>}
          <Table
            head={[derived ? "Criterio" : "Competencia", "Promedio", "Nivel", "Labs", "Cambio", "Evidencia incompleta"]}
            widths={[34, 12, 16, 8, 12, 18]}
            rows={stats.competencies.map((c) => [c.competency, `${c.percent} %`, BAND_LABEL[c.band], String(c.labs), delta(c.delta), c.weakEvidence > 0 ? `${c.weakEvidence} criterio(s)` : "-"])}
          />
          {stats.competencies.map((c) => (
            <Bar key={c.competency} label={c.competency} percent={c.percent} />
          ))}
          <T style={s.small}>Promedio ponderado por el peso de cada criterio. «Cambio» es la diferencia, en puntos porcentuales, entre el primer y el último laboratorio donde aparece.</T>
        </Section>

        <Section n={4} title="Promedio por corte">
          <Table head={["Corte", "Laboratorios", "Promedio"]} widths={[40, 30, 30]} rows={stats.byCut.map((c) => [c.cut ? `Corte ${c.cut}` : "Sin corte", String(c.labs), `${c.averagePercent} %`])} />
        </Section>

        <Section n={5} title="Fortalezas">
          <Bullets items={stats.recurringStrengths} empty="Todavía no hay una fortaleza que se repita en 2 o más laboratorios." />
          {a && a.fortalezas.length > 0 && (
            <View>
              <T style={s.h2}>Lectura de la IA</T>
              <Bullets items={a.fortalezas} />
            </View>
          )}
        </Section>

        <Section n={6} title="Brechas y conceptos por reforzar">
          {stats.gaps.length === 0 ? (
            <T style={[s.p, s.small]}>Ningún criterio bajo el 85 % ni con evidencia incompleta.</T>
          ) : (
            <Table
              head={["Criterio", "Laboratorio", "Cumplimiento", "Evidencia"]}
              widths={[40, 28, 16, 16]}
              rows={stats.gaps.map((g) => [g.criterion, g.lab, `${g.percent} %`, g.evidence])}
            />
          )}
          <T style={[s.p, s.small]}>{`Conceptos: ${counts.demostrado} demostrados, ${counts.parcial} parciales y ${counts.refuerzo} por reforzar.`}</T>
          <Bullets items={toReinforce.map((c) => `${c.name}${c.recurrent ? " (recurrente: se pidió reforzar en 2 o más laboratorios)" : ""} - aparece en: ${c.labs.join(", ")}`)} empty="No hay conceptos por reforzar en las evaluaciones actuales." />
          {a && a.brechas.length > 0 && (
            <View>
              <T style={s.h2}>Lectura de la IA</T>
              {a.brechas.map((b, i) => (
                <View key={i} style={s.card} wrap={false}>
                  <T style={s.bold}>{b.tema}</T>
                  <T>{b.por_que}</T>
                  {b.laboratorios.length > 0 && <T style={s.small}>{`Laboratorios: ${b.laboratorios.join(", ")}`}</T>}
                </View>
              ))}
            </View>
          )}
        </Section>

        <Section n={7} title="Diagnóstico y plan personalizado de fortalecimiento">
          {!analysis || !a ? (
            <T style={[s.p, s.small]}>Todavía no se generó el análisis con IA del semestre. Puedes generarlo en la sección «Análisis del semestre» de la plataforma y volver a descargar este informe.</T>
          ) : (
            <View>
              <T style={[s.p, s.small]}>{`Generado el ${fmtDate(analysis.createdAt)} con ${analysis.labsCount} laboratorio(s).${d.analysisCurrent ? "" : " ATENCIÓN: está desactualizado; tus evaluaciones cambiaron desde entonces."}`}</T>
              {analysis.warnings.map((w, i) => (
                <T key={i} style={[s.p, { color: "#8A4B00" }]}>{`Aviso: ${w}`}</T>
              ))}
              <T style={s.h2}>Diagnóstico</T>
              <T style={s.p}>{a.diagnostico}</T>
              <T style={s.h2}>Evolución</T>
              <T style={s.p}>{a.evolucion}</T>
              {a.competencias.length > 0 && (
                <View>
                  <T style={s.h2}>{derived ? "Lectura por criterio" : "Lectura por competencia"}</T>
                  {a.competencias.map((c, i) => (
                    <T key={i} style={s.p}><Text style={s.bold}>{pdfSafe(c.competencia)}: </Text>{pdfSafe(c.lectura)}</T>
                  ))}
                </View>
              )}
              <T style={s.h2}>Plan de fortalecimiento</T>
              <T style={s.p}>{a.plan.objetivo}</T>
              {a.plan.acciones.map((x, i) => (
                <View key={i} style={s.card} wrap={false}>
                  <T style={s.bold}>{`${i + 1}. ${x.tema} (prioridad ${PRIORITY[x.prioridad]} - ${x.tiempo})`}</T>
                  <Bullets items={x.pasos} />
                  <T><Text style={s.bold}>Cómo sabrás que lo lograste: </Text>{pdfSafe(x.logro)}</T>
                  {x.laboratorios.length > 0 && <T style={s.small}>{`Relacionado con: ${x.laboratorios.join(", ")}`}</T>}
                </View>
              ))}
              {a.plan.orden_sugerido ? <T style={s.p}><Text style={s.bold}>Orden sugerido: </Text>{pdfSafe(a.plan.orden_sugerido)}</T> : null}
              {a.plan.habitos.length > 0 && (
                <View>
                  <T style={s.h2}>Hábitos que ayudan</T>
                  <Bullets items={a.plan.habitos} />
                </View>
              )}
            </View>
          )}
        </Section>

        <Section n={8} title="Limitaciones y trazabilidad">
          <Bullets
            items={[
              "Las notas son estimaciones orientativas generadas con IA sobre los archivos que subiste; no reemplazan la calificación de tu docente.",
              "Los porcentajes y promedios los calcula el sistema con las ponderaciones de cada rúbrica confirmada; la IA no calcula notas.",
              "Los laboratorios sin evaluación no cuentan en los promedios y no se interpretan como no entregados.",
              analysis ? `Diagnóstico y plan generados con el modelo: ${analysis.model || "no registrado"}.` : "El diagnóstico y el plan con IA no se han generado todavía.",
            ]}
          />
        </Section>

        <View style={s.footer} fixed>
          <T>Estimación orientativa generada con IA. No es una calificación oficial.</T>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderSemesterReportPdf(d: SemesterReportData): Promise<Buffer> {
  return renderToBuffer(<SemesterReportDocument d={d} />);
}
