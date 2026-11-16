# Arquitectura y decisiones de diseño

Este documento describe cómo está construida la plataforma, por qué se tomaron las decisiones principales y cuáles son sus límites. Complementa a `DESARROLLO_CON_IA.md` (proceso de desarrollo) y `PRUEBAS_FUNCIONALES.md` (verificación).

## 1. Vista general

```
Navegador ──► Vercel (Next.js, funciones de servidor) ──► Supabase (PostgreSQL + RLS, Auth, Storage privado)
    │                         │
    │                         └──► API de Gemini (Google): rúbricas, valoración, redacción
    └──► Storage (subida directa de archivos, con política de cuota)
```

- **Cliente:** páginas de Next.js (App Router). Los archivos se suben **directo del navegador a Supabase Storage** (el cuerpo de una petición en Vercel gratuito es pequeño); el servidor después verifica cada archivo subido.
- **Servidor (Vercel):** componentes de servidor, acciones de servidor y rutas `/api`. Tiene dos clientes de Supabase: uno **con la sesión del usuario** (todo lo que lee pasa por RLS) y uno **con la clave de servicio** que solo se usa para escribir resultados que el estudiante no puede escribir.
- **Datos (Supabase):** PostgreSQL con seguridad por filas, autenticación de correo y contraseña, y un bucket privado `documents`.
- **IA:** llamadas al API de Gemini desde el servidor, con respuestas JSON validadas.
- **Protección de rutas:** `src/proxy.ts` redirige al inicio de sesión toda ruta que no sea pública (`/login`, `/registro`, `/recuperar`, `/auth`, `/revision`, `/acerca`).

## 2. Modelo de datos

| Tabla | Contenido | Quién escribe |
|---|---|---|
| `profiles` | Perfil y consentimiento de uso de IA | Usuario (lo suyo) |
| `subjects` | Asignatura, periodo y escala de nota | Usuario |
| `reference_materials` | Guías, rúbricas y otros materiales (con categoría y versión) | Usuario |
| `labs` | Laboratorio: nombre, corte, número, descripción, objetivos, repositorio, guía y rúbrica asociadas | Usuario |
| `lab_files` | Archivos del laboratorio (ruta en Storage, ruta relativa, tamaño) | Usuario |
| `rubrics`, `rubric_criteria` | Rúbrica versionada (borrador o confirmada) con sus criterios, niveles y pesos | Usuario hasta confirmar; luego bloqueada |
| `evaluations` | Evaluación: estado, nota y porcentaje calculados, resumen, retroalimentación, infografía, inventario de evidencias, resultados del análisis de código, trazabilidad (modelo, versión de prompts, copia de la rúbrica) y estado de revisión docente | **Solo servidor** |
| `criterion_results` | Valoración de cada criterio: nivel, porcentaje, citas, argumentación, recomendación, confianza, avisos | **Solo servidor** |
| `semester_analyses` | Análisis global del semestre y las estadísticas con las que se hizo, modelo y firma de entrada | **Solo servidor** |
| `review_links`, `teacher_reviews` | Enlaces de revisión docente (solo su hash) y las revisiones con sus ajustes | **Solo servidor** |
| `ai_usage` | Consumo de IA por usuario (para los topes diarios) | **Solo servidor** |
| `app_limits` | Topes de almacenamiento, ajustables sin cambiar código | Nadie desde la aplicación |
| `reports` | Reservada para informes guardados; **no se usa**: los PDF se generan bajo demanda | — |

Las 10 migraciones de `supabase/migrations/` se aplican en orden y son aditivas.

## 3. Seguridad y privacidad

- **RLS como única barrera de datos.** Cada tabla solo expone las filas del propietario. Las tablas de resultados son de solo lectura para el estudiante; un estudiante no puede ni siquiera insertar una evaluación a su nombre. Se verifica con `scripts/test-isolation-full.mts` (64 comprobaciones sobre las 14 tablas, Storage y funciones).
- **Storage privado** con carpeta por usuario (`<id>/...`); descargas con enlaces firmados de 60 s (300 s para el docente en la revisión).
- **Rúbricas inmutables al confirmarse:** la base de datos exige pesos que suman 100 % y bloquea editar una rúbrica confirmada; cada evaluación guarda una copia exacta de la rúbrica usada.
- **Los trabajos se tratan como datos, no como instrucciones** (defensa contra instrucciones escondidas en los archivos).
- **Nada de lo entregado se ejecuta.** Los archivos, ZIP y repositorios se leen como texto o imagen, con límites anti-ZIP-bomb y de rutas.
- **Revisión docente sin cuentas de docente.** El enlace son 32 bytes aleatorios; en la base solo se guarda su hash SHA-256; caduca a los 14 días, se puede revocar y se consume al enviar la revisión (de forma atómica). Las páginas llevan `Referrer-Policy: no-referrer`, `noindex` y `no-store`. El docente no escribe una nota libre: ajusta porcentajes por criterio con justificación y el sistema recalcula.
- **Claves:** `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY` solo existen en el servidor.
- **Límites de abuso:** topes de uso de IA (por usuario y globales) y de almacenamiento (por usuario y totales), descritos abajo.

## 4. Flujo de evaluación de un laboratorio

1. **Inicio** (`startEvaluation`): comprueba que hay una rúbrica **confirmada**, reserva el presupuesto de IA, crea la evaluación en estado «procesando» con una copia de la rúbrica.
2. **Lectura de evidencias** (`loadEvidence`, `buildEvidencePackage`): archivos del laboratorio y, si hay, el repositorio de GitHub. Documentos, hojas, presentaciones y notebooks se convierten a texto; PDF e imágenes se envían de forma nativa; se registran los archivos omitidos y por qué.
3. **Verificación técnica del código** (`checkCodeEvidence`): sintaxis y análisis estático (Ruff compilado a WebAssembly para Python y notebooks, Acorn para JavaScript, validación de JSON/JSONL) y detección de pruebas unitarias por su contenido. **No se ejecuta código.**
4. **Valoración** (`runAssessment`): **una sola petición** valora todos los criterios (la cuota gratuita no permite una por criterio). La IA devuelve, por criterio, nivel, porcentaje, citas, argumentación y recomendación en JSON.
5. **Verificación de citas** (`src/lib/assessment.ts`): cada cita se busca en el texto real de los archivos. Sin una cita verificable el criterio no recibe mérito; las citas solo de capturas o PDF (no comprobables) valen como evidencia parcial y no alcanzan el nivel más alto. Si el 60 % o más de los criterios queda sin ninguna cita verificable, se reintenta una vez y, si persiste, **no se publica ninguna nota**.
6. **Cierre** (`finalizeEvaluation`): el **sistema** calcula el porcentaje global (suma de peso × porcentaje) y la nota; la IA solo redacta resumen, retroalimentación e infografía sobre los resultados ya calculados.
7. **Revisión docente** (opcional): el estudiante genera un enlace; el docente aprueba, ajusta o devuelve; el sistema recalcula la nota final con los pesos.

El paso 4 y el 6 corren en `/api/evaluaciones/[id]/paso` con `maxDuration = 300`. Una evaluación completa en la URL pública tardó unos 2 minutos; el máximo de 300 s no se ha llevado al límite.

## 5. Integración de IA

**Estructura.** `src/lib/ai/` define una interfaz `AIProvider` (`generateJSON`) y una implementación para Gemini. El proveedor y el modelo se eligen por variables de entorno (`AI_PROVIDER`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`). Hoy **solo existe el proveedor de Gemini**; añadir otro (por ejemplo un modelo local) exige implementar la interfaz.

**Resultados estructurados.** Cada llamada declara un esquema JSON (dialecto de Gemini) y la respuesta se vuelve a validar con zod. Un resultado que no cumple el esquema se rechaza.

**La nota no la calcula el modelo.** `src/lib/scoring.ts` aplica los pesos de la rúbrica confirmada. Esto cumple la condición C2 del enunciado y está cubierto por pruebas.

**Versiones de prompt guardadas en cada resultado:** `criterio-v1`, `resumen-v1` y `semestre-v4`, junto con el modelo que respondió.

**Justificación de la elección (C4).**
- *Gemini por API:* tiene una capa gratuita, lee PDF e imágenes de forma nativa (útil para informes y capturas), admite salida JSON con esquema y permite razonamiento bajo para tareas de extracción.
- *Un modelo local* se descartó porque la plataforma se despliega en Vercel (no hay GPU ni procesos persistentes) y el costo cero era un requisito.
- *Sin modelo alterno por defecto:* un modelo ligero usado como alterno resultó más benévolo (100 % con confianza «alta») y mezclar modelos dentro de una evaluación resta consistencia.

**Requisitos, limitaciones y costos asociados.**

| Aspecto | Situación |
|---|---|
| Costo | $0 en capa gratuita (Gemini, Supabase, Vercel Hobby) |
| Cuota de IA | ~20 peticiones diarias por modelo, **compartidas por todos los usuarios** |
| Tiempos | Una evaluación tarda 1–2 min; con el modelo saturado puede superar el minuto por llamada (reintentos con espera y tiempo máximo de 100 s por llamada) |
| Modelo | `gemini-3-flash-preview` en producción: es un modelo *preview* y puede cambiar sin aviso |
| Calibración | No hay una nota docente real contra la cual comparar; la estimación tiende a ser alta y varía unos puntos entre ejecuciones |
| Privacidad | Los archivos del estudiante se envían a la API de Google para analizarlos; el perfil guarda el consentimiento de uso de IA |
| Pasar a pago | Subir de plan permitiría más cuota y modelos más estables; el código no cambia |

## 6. Informes, infografías y mapa mental

- **Informe PDF por laboratorio** (20 apartados) e **informe integrado del semestre**: se generan en el servidor con `@react-pdf/renderer` a partir de los datos guardados (reproducibles; no hay archivos duplicados que sincronizar). Las fuentes estándar de PDF solo cubren Latin-1: los símbolos fuera de ese rango se sustituyen.
- **Estadísticas del semestre** (`semester-stats.ts`): las calcula el sistema, sin IA. La nota efectiva de un laboratorio es la del docente si fue aprobada o ajustada y, si no, la estimación de la IA. Los niveles de dominio (85/70/50 %) son propios de la plataforma.
- **Análisis del semestre con IA** (`evaluate-semester.ts`): la IA solo redacta sobre cifras ya calculadas. Controles del lado del sistema: una cifra con «%» que el sistema no calculó se detecta y se reintenta; los conceptos, laboratorios y competencias de brechas y plan se derivan de los datos, no de lo que diga la IA. Se guarda una firma de la entrada: si nada cambió no se gasta una petición.
- **Mapa mental** (`mindmap-data.ts` y `mindmap-view.tsx`): árbol construido solo con evaluaciones reales y dibujado en SVG propio, sin librerías (zoom, arrastre, panel de detalle con citas verificables, filtro «Solo fortalezas», descarga PNG y SVG).
- **Infografías:** por laboratorio y del semestre, descargables como PNG (`html-to-image`).

## 7. Límites de uso

| Recurso | Tope | Por qué |
|---|---|---|
| IA por usuario | 12 unidades / 24 h (evaluación = 3; rúbrica, análisis o rellenar laboratorio = 1) | Proteger la cuota compartida |
| IA global | 18 unidades / 24 h | Dejar margen de reintentos bajo las ~20 peticiones gratuitas |
| Almacenamiento por usuario | 250 MB y 2.500 archivos | El plan gratuito de Supabase da 1 GB en total |
| Almacenamiento total | 900 MB | Margen sobre el gigabyte gratuito |
| Archivo | 50 MB; 300 archivos por carga | Límite del plan gratuito y de la petición |

Los topes de IA son una **ventana móvil de 24 horas** con reserva atómica en SQL; los de almacenamiento se aplican en una política de Storage y se vuelven a comprobar al registrar cada archivo. Los de IA se pueden cambiar por variables de entorno; los de almacenamiento, en la tabla `app_limits`.

## 7b. Retención, borrado y copias de seguridad

- **Retención:** los datos se conservan mientras la cuenta exista. No hay borrado automático por antigüedad.
- **Derecho al borrado:** en **Mi perfil → Eliminar mi cuenta y mis datos** la persona borra su cuenta y todo lo suyo. Exige escribir el correo y la contraseña actual. El servidor (`src/lib/delete-account.ts`) borra primero todos sus archivos de Storage y, solo si no quedó ninguno, su usuario; la base elimina en cascada perfil, asignaturas, laboratorios, rúbricas, evaluaciones, análisis, enlaces de revisión y consumo de IA. Si algo falla antes de borrar el usuario no se pierde nada y se puede reintentar. Probado con la base real (`scripts/test-delete-account.mts`, 5 comprobaciones, incluido un segundo usuario que debe quedar intacto y el borrado de más de 100 archivos).
- **Copias de seguridad:** el plan gratuito de Supabase **no ofrece copias automáticas descargables**. Se agregó una copia manual, `scripts/backup-datos.mts`, que exporta todas las tablas a JSON y, con `--archivos`, descarga también los archivos de Storage a `backups/` (ignorada por git, porque contiene datos personales). No es automática: hay que ejecutarla y guardar el resultado en un lugar privado. Sin una copia, un error en la base de datos o en el proyecto de Supabase podría perder los datos.
- **Pendiente:** exportar los datos desde la propia interfaz (portabilidad) y programar las copias.

## 8. Estructura del código

```
src/app/          páginas y rutas: (auth), (app) [panel, laboratorios, materiales, análisis, mapa, perfil], acerca, revision, api
src/components/   interfaz compartida, infografías, pestañas
src/lib/          lógica de dominio: evaluación (evaluate-*, run-*, assessment, scoring), rúbricas, evidencias, análisis de código,
                  semestre (semester-*, mindmap-data), informes PDF, revisión docente, límites (ai-budget, storage-quota), ai/ (proveedor)
src/lib/supabase  clientes de Supabase (navegador, servidor, administración)
supabase/migrations/  esquema, políticas RLS y funciones SQL
scripts/          pruebas y verificaciones
docs/             documentación
```

## 9. Pendientes y mejoras posibles

- Ejecución de código en un entorno aislado (sandbox) y ejecución real de pruebas unitarias (C3).
- Proveedor de IA local u otro proveedor en la nube.
- Confirmación de correo con un servicio de correo propio.
- Copias de seguridad programadas, exportación de datos desde la interfaz y una pantalla para limpiar archivos huérfanos de Storage.
- Análisis de audio y video como evidencia.
- Calibración de la estimación con notas reales de docentes.
