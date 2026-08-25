# Ayuda

## Qué es esto

- **Sistemas Eq**: resuelve sistemas de ecuaciones lineales (reales o complejas) con cualquier número de incógnitas.
- **Integrales**: calcula integrales definidas de una variable real, con resultado real o complejo.

Esta herramienta tiene dos calculadoras independientes, disponibles en el menú superior:

Ambas comparten el mismo lector de expresiones matemáticas (la misma sintaxis descrita abajo), el mismo sistema de variables conocidas, el mismo resaltado de color al escribir, y la misma exportación a PDF.

## Sintaxis aceptada

| Elemento | Ejemplos |
| --- | --- |
| Números | `12`, `3.5`, `0.001` |
| Operadores | `+` `-` `*` `/` `^` (potencia) |
| Paréntesis / llaves | `(...)` y `{...}` — se pueden mezclar y anidar; se colorean por nivel de anidación |
| Multiplicación implícita | `2\pi`, `3\sin(x)`, `2(x+1)` equivalen a `2*\pi`, `3*\sin(x)`, `2*(x+1)` |
| Funciones | `\sin` `\cos` `\tan` `\cot` `\sec` `\csc` y sus inversas `\asin`… e hiperbólicas `\sinh`, `\cosh`, etc. (e inversas `\asinh`…) |
| Otras funciones | `\ln(...)`, `\sqrt(...)`, `\exp(...)`, `\log_10(...)` (la base va después del guion bajo) |
| Constantes | `\pi` (π), `e` (número de Euler), `j` (unidad imaginaria) |
| Igualdad | `=` — si una expresión no lleva `=`, se asume "`= 0`" |

Todos los campos de fórmula (ecuaciones, variables conocidas, expresión a integrar, límites) se interpretan con el mismo lector. Acepta:

Las funciones aceptan tanto la forma con paréntesis (`\sin(x)`) como la forma LaTeX con llaves (`\sin{x}`).

Los nombres de variable deben empezar por letra y solo contener letras y números (por ejemplo `x1`, `a`, `Vout`). No pueden usarse como nombre de variable las palabras reservadas: `e`, `j`, `pi`, `ln`, `log`, `sqrt`, `exp`, ni ningún nombre de función trigonométrica/hiperbólica (`sin`, `cos`, `asinh`, etc.).

Mientras se escribe, cada campo colorea en vivo los paréntesis por nivel, los comandos `\algo`, el signo `=` y los operadores — el mismo color se conserva al exportar a PDF.

## Variables conocidas

- **Explícita:** `a=12` — define `a` directamente.
- **Implícita:** `3*b=\ln(3/2)` — se despeja `b` automáticamente (la herramienta detecta cuál es el único nombre nuevo en la fila y lo resuelve por sondeo, asumiendo que la fila es lineal en esa variable).

Es la sección donde se definen constantes o parámetros que luego se pueden usar dentro de las ecuaciones o de la integral. Cada fila define **una sola variable nueva**, de dos formas:

Una variable conocida puede usar en su definición cualquier variable conocida ya definida en una fila anterior. No se permite definir la misma variable dos veces, ni dos variables nuevas en una misma fila.

## Sistema de ecuaciones

1. **Variables desconocidas:** agrega tantas filas como incógnitas quieras resolver (por ejemplo `x1`, `x2`).
2. **Variables conocidas:** opcional (ver sección anterior).
3. **Sistema de ecuaciones:** se genera automáticamente una fila de ecuación por cada incógnita agregada. Cada ecuación debe ser **lineal (afín)** en las incógnitas — se permiten sumas, restas y multiplicación/división por constantes o variables conocidas, pero no productos entre incógnitas ni potencias de una incógnita distintas de 1.

**Procedimiento:** cada ecuación se evalúa numéricamente con las incógnitas puestas en 0 y en 1 (una por una) para extraer sus coeficientes sin derivar simbólicamente, comprobando en el proceso que la ecuación sea realmente lineal. Con esos coeficientes se arma el sistema A·x = b y se resuelve por **eliminación gaussiana con pivoteo parcial**, con soporte completo para números complejos. Si el sistema no tiene solución única (matriz singular), se informa el error.

## Integral definida

1. **Variables definidas:** opcional, igual que en el sistema de ecuaciones.
2. **Límites:** el límite inferior y superior deben ser expresiones que se evalúen a un número **real** (pueden usar variables conocidas y `\pi`, pero no la variable de integración).
3. **Variable de integración:** el nombre que se está integrando (por ejemplo `x`). Debe ser distinto de cualquier variable conocida.
4. **Expresión:** la función a integrar, f(variable). Puede tomar valores complejos (usando `j`), aunque la variable de integración y los límites son siempre reales.

**Procedimiento:** no hay integración simbólica. El cálculo se hace por **cuadratura de Simpson adaptativa** (método de Gander–Gautschi), integrando por separado la parte real y la parte imaginaria de la expresión y recomponiendo el resultado complejo al final.

## Contexto

Ambas calculadoras tienen un campo de texto libre llamado "Contexto", pensado para anotar el propósito o el trasfondo del cálculo (de dónde salió, para qué proyecto, qué representa cada variable, etc.). Es completamente opcional, se guarda junto con el resto de los datos y aparece al principio del reporte cuando exportas a PDF.

## Historial de resultados (solo en Integrales)

- Cada entrada tiene un campo de **título** editable, para identificarla más fácilmente.
- El botón **✕** de cada entrada borra solo esa entrada.
- El botón **"Limpiar historial"** borra todo el historial, sin tocar el resto de los datos.
- El botón general **"Limpiar todo"** también borra el historial, además de las variables y los datos de la integral.

Cada vez que se calcula una integral con éxito, se agrega una entrada al historial con la fecha y hora, los límites, la expresión integrada y el resultado. **Las variables conocidas no se guardan en el historial** — solo el planteamiento y el resultado de la integral en sí.

El historial completo se incluye también en el PDF (ver siguiente sección).

## Exportar a PDF

El botón "Descargar PDF" primero recalcula con los datos actuales y luego abre el diálogo de impresión del navegador (elige "Guardar como PDF" como destino). Puedes escribir un título para el reporte en el campo junto al botón.

En **Sistemas Eq** el reporte incluye: contexto (si hay), variables desconocidas, variables conocidas resueltas, el sistema tal como se ingresó, y la solución final.

En **Integrales** el reporte incluye: contexto (si hay), variables definidas resueltas, y el historial completo de resultados (con título, fecha, planteamiento y resultado de cada integral calculada) — por eso el resultado más reciente ya aparece ahí, sin necesidad de una sección aparte.

Los colores de sintaxis de las expresiones se conservan en el PDF, igual que se ven en pantalla.

## Datos y persistencia

Todo lo que escribes (incógnitas, variables, ecuaciones, datos de la integral, contexto e historial) se guarda automáticamente en el navegador (`localStorage`) y sigue ahí aunque cierres la pestaña o recargues la página. Nada se envía a ningún servidor. El botón "Limpiar todo" de cada página borra únicamente los datos de esa página. El tema (oscuro/claro) se comparte entre las tres páginas.

---

por josegonandez
