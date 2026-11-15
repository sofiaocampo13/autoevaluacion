# Desarrollo asistido por IA — registro de decisiones, problemas y límites

Documento exigido por la rúbrica del proyecto ("Documentar brevemente las herramientas utilizadas, sus aportes, limitaciones y decisiones técnicas"). Se actualiza a medida que avanza el desarrollo. Solo se anotan hechos comprobados en el trabajo.

## Herramientas

| Herramienta | Uso en el proyecto |
|---|---|
| **Claude Code** (CLI de Anthropic) | Asistente de programación principal: diseño de arquitectura, esquema SQL con RLS, backend, interfaz, scripts de prueba y depuración. Trabaja bajo supervisión de la estudiante, que aprueba cada fase, ejecuta los pasos en Supabase y prueba en el navegador. |
| **Google Gemini API** (capa gratuita) | Es parte del *producto*, no de la construcción: interpreta rúbricas, valora evidencias y redacta la retroalimentación. |
| **Supabase** | Base de datos Postgres, autenticación y almacenamiento privado. |

## Decisiones técnicas y su justificación

1. **Next.js + Supabase + Vercel, todo en capa gratuita.** Requisito del proyecto: URL pública y costo cero. Consecuencia: subidas directas a Storage (el cuerpo de petición de Vercel gratuito es pequeño) y evaluación por pasos cortos.
2. **Seguridad por filas (RLS) como única barrera de datos.** Cada tabla solo expone filas del propietario; las tablas de resultados son de solo lectura para el estudiante y las escribe el servidor. Verificado con una prueba de 11 comprobaciones contra la base real.
3. **La nota la calcula el backend, nunca el modelo.** Porcentaje ponderado con los pesos de la rúbrica confirmada (`src/lib/scoring.ts`). Exigido por la rúbrica del proyecto.
4. **Rúbricas inmutables al confirmarse.** La base de datos exige pesos que suman 100 % y bloquea editar una rúbrica confirmada; cada evaluación guarda una copia exacta (trazabilidad).
5. **Evidencia verificable.** Cada cita de la IA se comprueba contra el texto real del archivo. Sin cita verificable, el criterio queda sin mérito. Citas solo de capturas/PDF (no comprobables) valen como evidencia parcial y no alcanzan el nivel más alto.
6. **Los trabajos se tratan como datos, no como instrucciones.** Defensa contra instrucciones escondidas en los archivos (probado: un archivo hostil recibió 0 % y quedó marcado).
7. **Nada de lo entregado se ejecuta.** Los archivos, ZIP y repositorios se leen como texto o imagen, con límites anti-ZIP-bomb y de rutas. La verificación técnica del código es **estática**: sintaxis y análisis con Ruff (WebAssembly) para Python y notebooks, Acorn para JavaScript y validación de JSON. Se eligió así porque ejecutar código ajeno exige un sandbox con límites de recursos y sin red, que la capa gratuita de Vercel no ofrece. Las pruebas unitarias solo se detectan (por su contenido, no por el nombre del archivo), no se ejecutan.
8. **Una sola petición para valorar todos los criterios.** La cuota gratuita es de 20 peticiones diarias por modelo; valorar criterio por criterio (≈6 peticiones por laboratorio) era inviable.
9. **Sin modelo alterno por defecto.** Un modelo ligero usado como alterno resultó más benévolo (100 % con confianza "alta") y mezclar modelos resta consistencia. El alterno sigue siendo configurable y, si se usa, queda como aviso visible.
10. **Informe PDF generado bajo demanda a partir de los datos guardados** (`@react-pdf/renderer`, en el servidor). Así es reproducible y no hay archivos duplicados que sincronizar; con el cliente del usuario, RLS garantiza que solo se genere el informe de evaluaciones propias. Sigue los 20 apartados del enunciado, con tablas y gráfico de barras. Las fuentes estándar de PDF solo cubren Latin-1: los símbolos fuera de ese rango se sustituyen.
11. **Revisión docente por enlace, sin cuentas de docente.** Exigida por la rúbrica del proyecto y compatible con el enunciado original (que prohibía un módulo docente): el estudiante genera un enlace; el docente solo ve esa evaluación. El enlace son 32 bytes aleatorios; en la base solo se guarda su hash SHA-256; caduca a los 14 días, se puede revocar y se consume al enviar la revisión (de forma atómica: con envíos simultáneos solo uno se registra). El docente no escribe una nota libre: ajusta porcentajes de criterios con justificación y el sistema recalcula con los pesos. Las páginas llevan `Referrer-Policy: no-referrer`, `noindex` y `no-store`; los archivos no seguros (HTML, código) se descargan en vez de abrirse.

## Problemas encontrados y cómo se resolvieron

| Problema | Causa | Resolución |
|---|---|---|
| Citas reales rechazadas por el verificador (falsos negativos), tres veces | Exigía texto literal y contiguo; la IA quita marcas de Markdown, omite líneas de código y abrevia filas de tablas | Comparación solo de letras y números, y cada línea o celda citada debe existir por separado. Una frase inventada sigue rechazada. Probado con archivos reales y casos adversos. |
| Todo en 0 % con un modelo en pruebas | Combinación de lo anterior y un prompt que pedía pocas citas | Prompt con 3 a 6 citas cortas; verificador corregido. |
| Evaluación de 7,5 min | Criterios en serie, esperas de hasta 100 s a un modelo saturado | Petición única + tiempo máximo por llamada. |
| Error de cuota "agotada" poco informativo | Se trataba igual el límite por minuto y el diario | Se lee el detalle del 429: espera si es por minuto, avisa claramente si es diario. |
| Pantalla sin refrescar tras una acción larga y sin señal de progreso | Acción de servidor sin estado de carga | Indicador de progreso con segundos transcurridos; botón con estado pendiente. |
| Campo "Laboratorio asociado" sin efecto | Guardaba el vínculo pero nada lo usaba | Ahora asigna la guía/rúbrica del laboratorio. |
| Evaluación publicada con 0/5 y retroalimentación que culpaba al estudiante | La IA copió el marcador completo `[EVIDENCIA · ubicación: ruta]` en el campo de ubicación; el verificador no encontró el archivo y descartó las 15 citas, que eran reales | Se limpia el marcador antes de verificar (probado, incluida una cita inventada con marcador, que sigue rechazada). **Freno de seguridad:** si el 60 % o más de los criterios queda sin ninguna cita verificable, se reintenta una vez y, si persiste, no se guarda ni se publica ninguna nota. La evaluación errónea se invalidó. |
| Infografía mostraba 0 conceptos por reforzar mientras la retroalimentación pedía reforzar tres | La infografía solo usaba los conceptos anotados dentro de cada criterio. Mi primera corrección fue demasiado agresiva: marcó como "refuerzo" el concepto amplio *Cuantización* porque lo pendiente era algo más específico (*relación entre cuantización y perplexity*) y ocultó lo realmente pendiente | La retroalimentación manda, en código y al mostrar (corrige también evaluaciones guardadas): un concepto cambia a refuerzo solo si coincide con lo pendiente o es más específico; si lo pendiente es más específico que un concepto demostrado, se agrega como concepto nuevo en "Por reforzar". Verificado con los datos reales y 6 pruebas. |
| Informe PDF con etiquetas sin tildes y numeración duplicada ("5. 5. Reto integrador") | Evité las tildes por precaución con la codificación, pero la fuente las soporta; además el nombre del criterio ya traía su número | Etiquetas con tildes y numeración solo si el nombre no la trae. Revisado visualmente (PDF convertido a imagen) y por código. |
| Permiso por columna inefectivo (diseño inicial de la migración de revisión docente) | En PostgreSQL, `REVOKE SELECT (columna)` no sirve si la tabla ya tiene permiso completo (así lo concede Supabase por defecto) | Se revoca el permiso de la tabla y se conceden solo las columnas permitidas. Verificado con un usuario real con sesión: no puede leer `token_hash` ni usar `select *`, ni escribir revisiones ni auto-aprobar evaluaciones. |
| Archivos `*_test.py` contados como pruebas unitarias | Se detectaban por el nombre; eran scripts que llaman a una API | Se detectan por su contenido (`unittest`, `pytest`, funciones `test_*`). |
| Texto obsoleto "se habilita en la fase 3" | Marcador mío que quedó tras implementar la función | Eliminado. |

Errores míos de edición (código corrupto por reemplazos con scripts, un archivo roto por una edición descuidada) se detectaron con `tsc`, `eslint` y relectura, y se corrigieron antes de continuar.

## Lo que se comprobó con datos reales y lo que no

**Comprobado:** verificación técnica sobre 11 archivos Python reales (0 errores, 0,3 s) y 12 casos adversos (código roto, etiquetas Markdown en un .py, notebook, JSON/JSONL inválidos, prueba unitaria real); aislamiento entre usuarios (11/11); interpretación de una rúbrica real (pesos 15/20/20/20/25 coinciden con el documento); lectura de 53 archivos de un laboratorio; ZIP malicioso (6 de 8 entradas rechazadas); repositorio de GitHub público e inexistente; inyección de instrucciones (0 %); verificador (18 pruebas unitarias); revisión docente (14 pruebas de lógica y 15 de seguridad contra la base real: enlaces falsos, revocados, vencidos, reutilizados y envíos simultáneos); sensibilidad (al quitar el 36 % de las evidencias, la nota global bajó de 4,9 a 4,4 y el criterio más afectado a 75 % parcial).

**No comprobado / límites conocidos:**
- No hay una nota del docente con la que **calibrar** la exigencia: la IA da 95–100 % al laboratorio de prueba; puede ser merecido o benévolo.
- El contenido de **capturas y PDF** no se verifica automáticamente.
- El código entregado **no se ejecuta**; solo se analiza estáticamente (Python, notebooks, JavaScript y JSON). Otros lenguajes no se analizan.
- La IA gratuita es **irregular**: latencias de hasta más de un minuto, saturación (503) y cuota diaria de 20 peticiones por modelo.
- Algunos modelos usados son "preview" y pueden cambiar sin aviso.
- La revisión docente, el informe PDF, la infografía, el análisis del semestre y el mapa mental interactivo **no están construidos** aún.
