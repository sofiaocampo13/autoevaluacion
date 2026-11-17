# Plataforma de autoevaluación académica con IA — Plan por fases (v2)

Revisado contra la rúbrica oficial: *Proyecto Final Profundización I – Asesor Pedagógico Inteligente* (Universidad de Manizales). Estado al 2026-11-12.

## Stack (capa gratuita)
Next.js 16 + TypeScript en Vercel · Supabase (Postgres, Auth, Storage, RLS) · Gemini `gemini-3.5-flash` (configurable por `GEMINI_MODEL`; `gemini-2.5-flash` ya no está disponible para cuentas nuevas).

## Estado por fase (actualizado 2026-11-15)
- **Fase 1 (cuentas, datos, seguridad): HECHA.** Aislamiento verificado (11/11).
- **Fase 2 (materiales, laboratorios, cortes, carpetas, importación): HECHA.** Faltan materiales precargados.
- **Fase 3a (rúbricas editables y confirmables, lectura de documentos, ZIP y repositorio GitHub, trazabilidad): HECHA.**
- **Fase 3b (motor de evaluación con IA): HECHA y probada en la app.** Valoración de todos los criterios en una petición, citas verificadas, nota calculada en código, resultados guardados con trazabilidad.
- **Fase 3c (verificación objetiva del código): HECHA, con límites.** Validación de sintaxis y análisis estático (Python y notebooks con Ruff WASM, JavaScript con Acorn, JSON/JSONL) y detección de pruebas unitarias por contenido; se guarda en la evaluación y se usa como evidencia objetiva. **El código no se ejecuta** (no hay sandbox gratuito en Vercel) y las pruebas unitarias no se corren: el informe lo declara. Otros lenguajes (Java, C, TypeScript…) no se analizan.
- **Fase 4 (resultados, infografía, informe PDF, revisión docente): HECHA, falta probar el flujo completo en el navegador.** Pestañas de resultados, infografía individual (PNG), informe PDF de 20 apartados y **revisión docente por enlace** (enlace secreto de 14 días, solo se guarda su hash, un único uso, ajustes con justificación, nota recalculada por el sistema). Pendiente menor: historial con comparación entre evaluaciones.
- **Fase 5 (análisis del semestre, mapa mental, infografía e informe integrado): HECHA, falta probar el PDF y la infografía descargada en el navegador.** Estadísticas del semestre sin IA (tablero y página de análisis), diagnóstico y plan personalizado con IA (con controles de cifras), mapa mental interactivo SVG (zoom, arrastre, panel de detalle, descarga PNG/SVG, filtro «Solo fortalezas»), infografía general del semestre (PNG) e informe integrado en PDF. Pendiente: calibrar con una nota real de un docente.
- **Fase 6 (presentación, endurecimiento y despliegue): HECHA, salvo lo indicado.** Desplegada en https://autoevaluacion-kwff.vercel.app (Vercel + Supabase, capa gratuita); página «Acerca del proyecto» con el equipo; límites de uso de la IA y del almacenamiento; correo propio con confirmación de cuenta y enlaces que funcionan desde cualquier dispositivo; eliminar cuenta y datos; copia de seguridad manual; confirmación antes de borrar; diseño propio a partir de los mockups de las integrantes; 20 pruebas funcionales documentadas; documentación técnica (`README.md`, `docs/ARQUITECTURA.md`). **Decidido dejar fuera:** audio y video (cuota de IA gratuita y opcional en el enunciado). Las pruebas manuales de `docs/PRUEBAS_FUNCIONALES.md` se ejecutaron y quedaron como reportadas (sin capturas). **Pendiente:** calibrar la nota con un docente real y ejecutar la copia de seguridad antes de la entrega.

## Riesgos abiertos
1. **Cuota gratuita de IA:** 20 peticiones al día por modelo; cada evaluación usa 2. Alcanza para ~10 laboratorios por modelo y día. Una demostración con muchos laboratorios seguidos requiere margen, o una capa de pago pequeña.
2. **Calibración:** sin nota real del docente no se sabe si la exigencia es la adecuada (el laboratorio de prueba sacó 4,9/5).
3. **Capturas/PDF no verificables** automáticamente (mitigado: no alcanzan el nivel más alto por sí solos).
4. **Duración máxima de funciones en Vercel gratuito:** la ruta de evaluación declara 300 s; se verifica al desplegar.
5. **Modelos "preview"** pueden cambiar o retirarse.

## Matriz de cumplimiento frente a la rúbrica

| # | Exigencia de la rúbrica | Estado | Dónde se resuelve |
|---|---|---|---|
| F1 | Entrada por laboratorio: descripción y **objetivos**, rúbrica, solución | Parcial (falta campo *objetivos*) | Fase 3a |
| F2 | Portafolio por laboratorio: PDF + **código (repo GitHub o ZIP)** + rúbrica; versión de rúbrica conservada | **Falta** ZIP y repo GitHub | Fase 3a |
| F3 | **Gestión de rúbricas**: interpretar, parametrizar (competencias, criterios, descriptores, niveles, pesos = 100 %), detectar inconsistencias y **permitir corregirlas antes de evaluar** | **Falta** (no hay tablas de rúbrica ni editor) | Fase 3a |
| F4 | Evaluación por criterio con evidencia citada, fortalezas/debilidades, recomendaciones, nota 0,0–5,0 | Planeado | Fase 3b |
| F4b | Nota preliminar **sujeta a revisión y aprobación docente** | **Contradice el enunciado original (sin docente)** | Fase 4, ver decisión |
| F5 | Informe integrado: valoraciones, competencias, niveles, evolución, brechas y **plan personalizado de fortalecimiento**; ver y descargar | Planeado (faltaba el *plan de fortalecimiento*) | Fase 5 |
| F6 | **Mapa mental interactivo** (navegar, explorar, descargar): por tema, laboratorios, evidencias, nivel de dominio, qué profundizar | Planeado como infografía **estática** → insuficiente | Fase 5 |
| F7 | **Abstract + foto, nombre y rol de cada integrante** | **Falta** | Fase 6 |
| C1 | Documentar el uso de IA en el desarrollo (herramientas, aportes, límites, decisiones) | **Falta** | Se escribe en paralelo: `docs/DESARROLLO_CON_IA.md` |
| C2 | Salida estructurada validada (JSON Schema/Pydantic); **nota calculada por el backend** | Planeado | Fase 3b |
| C3 | **Verificación objetiva del código**: sintaxis, análisis estático, pruebas; ejecución solo en **sandbox** sin red | **Falta** y es difícil en Vercel | Fase 3c (ver riesgo) |
| C4 | Conexión **configurable** a modelos locales o en la nube; justificar elección, requisitos, costos | Parcial (solo Gemini) | Fase 3b |
| C5 | URL pública, autenticación, usuarios, persistencia, almacenamiento seguro | Fase 1–2 listas; despliegue pendiente | Fase 6 |
| C6 | **Trazabilidad**: evidencias analizadas, versión de rúbrica, **modelo usado**, **resultados de pruebas**, justificaciones | Parcial (faltan columnas de modelo, versión y pruebas) | Fase 3a |

## Fases pendientes

### Fase 3a — Rúbricas, portafolio y trazabilidad (base de la evaluación)
- Migración 0003: tablas `rubrics`, `rubric_competencies`, `rubric_criteria` (descriptores y niveles), con versión; campo `objectives` en laboratorios; columnas de trazabilidad en `evaluations` (modelo, versión de rúbrica, resultados de pruebas).
- Extracción de texto: PDF, DOCX, XLSX, PPTX, texto/código, imágenes (visión).
- **Rúbrica:** la IA propone la estructura a partir del documento; el estudiante la **revisa y corrige en una tabla editable**; el sistema valida que los pesos sumen 100 % y marca inconsistencias; solo una rúbrica confirmada puede usarse para evaluar.
- **ZIP** (extracción segura: anti zip-bomb, anti rutas `../`, límites de tamaño y número) y **enlace a repositorio GitHub público** como fuente del código.
- Materiales precargados (script de siembra con la clave de servicio).

### Fase 3b — Motor de evaluación con IA
- Etapas: comprender actividad → criterios de la rúbrica confirmada → analizar evidencias → valorar → resultados.
- Salida JSON validada con esquema. **Nota y porcentajes calculados en el backend** con los pesos de la rúbrica; el modelo nunca calcula la nota.
- Regla dura: sin evidencia citable (archivo/página/línea) → "evidencia inexistente".
- Capa `AIProvider` con dos adaptadores: **Gemini** y **endpoint compatible con OpenAI** (cubre Ollama/LM Studio locales y otros). Selección por configuración. Documento de justificación, requisitos y costos.
- Advertencia obligatoria en cada nota. Evaluaciones en estado **preliminar**.

### Fase 3c — Verificación objetiva del código
- Verificaciones **sin ejecutar** código ajeno: validación de sintaxis (Python por `ast`, JS/TS por parser), análisis estático básico, conteo de pruebas presentes. Resultados guardados y mostrados en la evaluación.
- **Ejecución de pruebas en sandbox:** NO es viable de forma segura en Vercel Hobby. Opciones a decidir: (a) worker aparte con contenedor sin red (p. ej. servicio gratuito o GitHub Actions), (b) no ejecutar y declararlo explícitamente como limitación. **No se afirmará que se ejecutó código si no se hizo.**

### Fase 4 — Resultados por laboratorio, informe PDF y revisión docente
- Valoración general, retroalimentación, infografía individual, informe PDF de 20 secciones, historial.
- **Revisión docente** (según la decisión tomada): estado *preliminar → revisada/aprobada*, con ajuste y comentario del docente y registro de quién y cuándo.

### Fase 5 — Informe integrado y mapa mental interactivo
- Análisis global de ambas cohortes/cortes, con evolución, brechas y **plan personalizado de fortalecimiento**; visualización y descarga PDF.
- **Mapa mental interactivo** (expandir/colapsar, zoom, panel de detalle por tema con laboratorios, evidencias, nivel de dominio y qué profundizar; descarga PNG/SVG). Gráficos solo con evaluaciones reales.
- Dashboard completo con accesos directos.

### Fase 6 — Presentación, audio/video, endurecimiento y despliegue
- Página pública **"Acerca del proyecto"**: abstract, tecnologías, aportes y tarjetas del equipo (foto, nombre, rol).
- Audio/video (transcripción; video requiere ffmpeg, probablemente en worker).
- SMTP propio + "Confirm email", límites de tasa, retención/borrado, copias de seguridad.
- Despliegue Vercel + Supabase, variables de entorno, monitoreo básico.
- Pruebas funcionales documentadas; **documentación del desarrollo asistido por IA** completa.

## Decisiones abiertas
1. ~~Revisión docente~~ — **RESUELTA (2026-11-12): enlace de revisión.** Sin cuentas ni módulo docente: el estudiante genera un enlace privado, temporal y revocable por evaluación; el docente ve evidencias y justificaciones, ajusta y aprueba la nota con comentario. La nota es "preliminar" hasta entonces y se registra quién y cuándo aprobó. Implementación en la fase 4.
2. **Sandbox para ejecutar pruebas** (fase 3c) — se decide al llegar.
3. **Datos del equipo** (integrantes, roles, fotos, abstract) — se piden en la fase 6.

## Restricciones de la capa gratuita
Vercel Hobby (cuerpo ≤ 4,5 MB → subidas directas a Storage; funciones cortas → evaluación por etapas) · Supabase Free (1 GB, pausa por inactividad, correo limitado) · Gemini gratuito (cuota por minuto/día; Google puede usar los datos enviados — aviso de consentimiento ya incluido).
