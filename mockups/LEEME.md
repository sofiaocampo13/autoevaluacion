# Mockups · Prisma (autoevaluación académica con IA)

Una captura completa (PNG, a 2x) y un HTML estático por pantalla. El HTML tiene los valores exactos de colores, espacios, radios y distribución, todo en estilos en línea. Los datos son de ejemplo y coinciden entre pantallas.

## Pantallas

| Archivo | Pantalla |
|---|---|
| login.html / login.png / login-registro.png | Acceso: iniciar sesión y crear cuenta |
| panel.html / panel.png / panel-390px.png | Dashboard principal |
| panel-movil.html / panel-movil.png | Dashboard móvil (390 × 844) |
| laboratorios.html / .png / -390px.png | Mis laboratorios |
| nuevo-laboratorio.html / .png | Cargar nuevo laboratorio y etapas de la IA |
| laboratorio-evaluado.html / .png | Lab evaluado, pestaña Valoración general |
| laboratorio-evaluado-retroalimentacion.png | Mismo lab, pestaña Retroalimentación |
| laboratorio-evaluado-infografia.png | Mismo lab, pestaña Infografía temática |
| materiales.html / .png | Materiales de referencia |
| informe-pdf.html / .png | Vista previa del informe PDF |
| historial.html / .png | Historial de evaluaciones |
| analisis.html / .png / -390px.png | Análisis global del semestre |
| mapa.html / .png | Infografía general de aprendizaje |

Los `-390px.png` muestran cómo se reacomodan las páginas de escritorio en un celular. Los HTML son estáticos: las pestañas y filtros se ven en su estado inicial (las otras pestañas están en los PNG). Los enlaces entre pantallas sí funcionan.

## Tokens de diseño

**Tipografía** (Google Fonts)
- Títulos: Fraunces 500 (acentos en itálica), 600 para el logo
- Texto e interfaz: Manrope 400–800
- Escala: H1 44px · H2 22–26px · cuerpo 14–15px · etiquetas 12–13px (mayúsculas, tracking 0.06–0.08em)

**Color**
| Rol | Hex |
|---|---|
| Fondo de página | #FAF7FD |
| Superficie / tarjeta | #FFFFFF, borde #ECE6F5 |
| Tinta (texto) | #221A35 |
| Texto secundario | #5A5170 / #6B6283 |
| Ciruela (menú lateral, bloques oscuros) | #1F1633 (líneas #3A2D56) |
| Violeta principal | #6D3FD9 (hover/oscuro #4C24A8, suave #EFE8FF) |
| Rosado | #C2306E (oscuro #9A1F55, suave #FCE7F1, claro sobre oscuro #F49AC1) |
| Azul | #2E5BD8 (oscuro #1E44A8, suave #E6EEFF, claro sobre oscuro #8FB0FF) |
| Lavanda (sobre oscuro) | #B9A2FF |
| Aviso / sin rúbrica | fondo #FFF4E0, texto #8A4B00 |

**Estados de dominio de conceptos**
- Demostrado: #2E5BD8 con texto blanco
- Parcial: #D9CCFB con texto #2B1767
- Requiere refuerzo: #C2306E con texto blanco
- Sin evidencia: fondo blanco con borde punteado 1.5px #9B90B2

**Forma y espacio**
- Radios: tarjetas 20–24px, chips y botones 999px (píldora), inputs 12–14px
- Botones e inputs: alto mínimo 44–52px
- Menú lateral: 248px; contenido con padding 32px arriba y 48px a los lados
- Separación entre tarjetas: 16–20px

**Reglas de contenido**
- Toda nota lleva el aviso: "Esta calificación es una estimación generada mediante inteligencia artificial con fines de autoevaluación académica. No corresponde a una calificación oficial ni sustituye la evaluación realizada por el docente."
- Nota = Σ(peso × cumplimiento) ÷ 100 × escala. Ejemplo: Lab 3 = 81,25 % → 4,1 / 5.
