"use client";

/** Último recurso: reemplaza al layout raíz, así que define su propio documento y estilos (sin Tailwind ni fuentes). */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#FAF7FD", color: "#221A35", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 16, padding: "0 clamp(16px, 4vw, 48px)", maxWidth: 620, boxSizing: "border-box" }}>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 500 }}>Algo salió mal</h1>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: "#4A4260" }}>Ocurrió un error inesperado. Puedes reintentar; si se repite, vuelve al inicio.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: 50, padding: "0 24px", borderRadius: 999, border: 0, background: "#C2306E", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
