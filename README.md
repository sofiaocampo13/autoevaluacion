# Asesor pedagógico inteligente

Plataforma web de **autoevaluación académica con IA**: el estudiante carga la descripción y los objetivos de un laboratorio, su rúbrica y su solución; la plataforma interpreta la rúbrica, analiza las evidencias con un modelo de IA, valora cada criterio citando fragmentos que el sistema verifica en los archivos y calcula una **nota orientativa** de 0,0 a 5,0. Un docente puede revisar y ajustar el resultado mediante un enlace seguro. Con todos los laboratorios se genera un informe integrado con plan de fortalecimiento y un mapa mental interactivo.

Proyecto final de Profundización I — Inteligencia Artificial (Universidad de Manizales).
**URL pública:** https://autoevaluacion-kwff.vercel.app · **Equipo:** `/acerca`

> Las calificaciones son estimaciones generadas con IA con fines de autoevaluación. No son calificaciones oficiales ni sustituyen la evaluación del docente.

## Qué hace

| Requisito del enunciado | Dónde está |
|---|---|
| F1 Entrada de información (descripción/objetivos, rúbrica, solución) | Mis laboratorios, Materiales |
| F2 Portafolio (PDF, código en ZIP o repositorio GitHub, carpetas) | Laboratorio → archivos; importación de carpeta del semestre |
| F3 Gestión de rúbricas (interpretar, parametrizar, validar, confirmar) | Laboratorio → Rúbrica |
| F4 Evaluación inteligente por laboratorio | Laboratorio → Evaluar; resultados, infografía, informe PDF, revisión docente |
| F5 Informe integrado del aprendizaje | Análisis del semestre (estadísticas, diagnóstico, plan, infografía, PDF) |
| F6 Mapa mental interactivo | Mapa mental |
| F7 Presentación del proyecto y equipo | `/acerca` |

Lo que **no** está construido: ver «Límites conocidos» más abajo.

## Pila tecnológica

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL con RLS, autenticación y Storage privado) · Gemini (Google) como modelo de IA · Vercel · `@react-pdf/renderer` · `html-to-image` · Ruff (WebAssembly) y Acorn para el análisis estático del código · zod.

Costo actual: **$0** (capas gratuitas de Vercel Hobby, Supabase y la API de Gemini), con los límites descritos en `docs/ARQUITECTURA.md`.

## Documentación

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md): arquitectura, modelo de datos, seguridad, flujo de evaluación, integración de IA (con la justificación de la elección, requisitos, limitaciones y costos).
- [`docs/DESARROLLO_CON_IA.md`](docs/DESARROLLO_CON_IA.md): cómo se desarrolló con asistentes de IA, decisiones técnicas, problemas encontrados y lo que se comprobó y lo que no.
- [`docs/PRUEBAS_FUNCIONALES.md`](docs/PRUEBAS_FUNCIONALES.md): 20 pruebas funcionales con su estado real.
- [`PLAN.md`](PLAN.md): plan por fases y matriz de cumplimiento.

## Puesta en marcha local

Requisitos: Node.js 22 o superior, un proyecto de Supabase y una clave de la API de Gemini.

1. `npm install`
2. Copia `.env.local.example` a `.env.local` y completa los valores:

   | Variable | Uso |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexión pública a Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor.** Escribe resultados que el estudiante no puede escribir |
   | `GEMINI_API_KEY` | **Solo servidor.** Clave de la API de IA |
   | `GEMINI_MODEL` | Modelo (por defecto `gemini-3.5-flash`) |
   | `GEMINI_FALLBACK_MODEL` | Opcional: modelo alterno (queda registrado y avisado) |
   | `NEXT_PUBLIC_SITE_URL` | URL pública, para los enlaces de correo y de revisión |
   | `AI_USER_DAILY_UNITS`, `AI_GLOBAL_DAILY_UNITS` | Opcionales: topes de uso de la IA (por defecto 12 y 18) |

3. Aplica las migraciones de `supabase/migrations/` en orden (`0001` a `0010`) desde el SQL Editor de Supabase.
4. En Supabase, **Authentication → URL Configuration**: Site URL y Redirect URLs con tu dirección pública y `http://localhost:3000/**`. Para el correo: **Authentication → Emails → SMTP Settings** con un SMTP propio (p. ej. Gmail con contraseña de aplicación) y las plantillas de «Confirm sign up» y «Reset Password» apuntando a `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (y `type=recovery` para la recuperación). El envío integrado de Supabase solo entrega a miembros de tu organización.
5. `npm run dev` y abre http://localhost:3000.

## Despliegue

Repositorio en GitHub conectado a Vercel (despliegue automático al subir a `main`). Las variables de arriba se configuran en Vercel; `NEXT_PUBLIC_*` se incrustan al compilar, así que cambiarlas exige un nuevo despliegue. `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY` deben ser de tipo secreto. Las rutas que llaman a la IA declaran `maxDuration = 300`.

## Pruebas

Los scripts de `scripts/` no necesitan un framework. Los que usan datos sintéticos se ejecutan con `node --import tsx scripts/<archivo>.ts`; los que tocan la base real, con `node --env-file=.env.local --import tsx scripts/<archivo>`. Detalles y resultados en `docs/PRUEBAS_FUNCIONALES.md`. Los scripts de PDF no cargan con `tsx`: ver la nota al inicio de `scripts/test-semester-pdf.mts`.

## Límites conocidos

- **El código entregado no se ejecuta.** Solo hay análisis estático (sintaxis y Ruff para Python y notebooks, Acorn para JavaScript, validación de JSON) y detección de pruebas unitarias. No hay sandbox gratuito. Otros lenguajes no se analizan.
- **No se calibró la nota con un docente.** La IA tiende a ser benévola (94–100 %) y la misma entrada puede variar unos puntos entre ejecuciones.
- **Solo Gemini está implementado.** La capa de IA es una interfaz (`AIProvider`), pero no hay un proveedor local.
- **Audio y video** no se analizan (decisión: la cuota de IA gratuita no alcanza y son opcionales en el enunciado). El contenido de capturas y PDF escaneados no se verifica automáticamente.
- **Cuota de IA gratuita:** unas 20 peticiones diarias por modelo, compartidas por todos los usuarios; por eso hay topes de uso.
- **Correo:** los correos de confirmación y recuperación salen de una cuenta de Gmail del proyecto (SMTP propio en Supabase) y pueden caer en spam, porque no hay un dominio propio con verificación de remitente. Gmail limita a unos 500 envíos al día.
- **Copias de seguridad:** el plan gratuito no las ofrece; hay una copia manual (`scripts/backup-datos.mts`), no programada.
- La nota del estudiante es una **estimación orientativa**; no hay módulo docente completo, solo la revisión por enlace.
