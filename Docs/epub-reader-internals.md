# EpubReader — Internals y Sistema de Tipografía

> Documento técnico crítico. Lee esto antes de tocar `EpubReader.jsx`.

---

## Cómo funciona epub.js en esta app

epub.js renderiza cada capítulo dentro de un **`<iframe>`** incrustado en `#viewer`. El iframe tiene su propio documento HTML, su propio `<head>` y su propio `<body>`. Esto significa que **ningún CSS del renderer de React afecta al contenido del libro** — es un documento separado con scope de estilo completamente aislado.

Para aplicar tipografía al texto del libro hay que **inyectar CSS directamente dentro del documento del iframe**.

---

## El sistema de estilos (`buildSharkCss`)

### Función principal

```js
// Definida al nivel de módulo (fuera del componente) en EpubReader.jsx
function buildSharkCss({ fontFamily, fontSize, lineHeight, pageMargins, customBg,
                         textJustify, firstLineIndent, letterSpacing,
                         hyphenation, paragraphSpacing }) { ... }
```

Genera una cadena CSS completa con reglas `!important` que sobreescriben el CSS propio del libro. Targets: `html`, `body`, `p`, `span`, `div`, `li`, `blockquote`, `td`, `th`, `a`, `em`, `strong`, `h1-h6`, `cite`, `q`, `small`.

**Por qué `!important` en todo**: Los EPUBs traen su propio CSS con reglas específicas sobre tipografía. Sin `!important`, cualquier `font-family: Georgia` dentro del EPUB gana. Con `!important` en nuestras reglas, el usuario siempre manda.

**Por qué `html { font-size: X% }` y `body { font-size: 1rem }`**: Algunos EPUBs usan `html { font-size: 62.5% }` como base para sus cálculos em/rem internos. Si ponemos `body { font-size: 110% }`, el resultado es `110% de 62.5%` = texto minúsculo. Al fijar `html { font-size: X% }` como nuestro punto de partida y `body { font-size: 1rem }` anclamos todo a nuestra base.

### `stylesRef` — el estado de estilos como ref

```js
const stylesRef = useRef({
    fontFamily, fontSize, lineHeight, pageMargins, customBg,
    textJustify, firstLineIndent, letterSpacing, hyphenation, paragraphSpacing
});
```

**Crítico**: Los callbacks de epub.js (`hooks.content.register`, `relocated`) se crean una sola vez durante el montaje. No capturan el estado React actual — capturan el closure del momento de creación. Por eso se usa un `ref` en lugar de leer el estado directamente: el `ref` siempre apunta al valor más reciente.

El `useEffect` de tipografía actualiza `stylesRef.current` al inicio, antes de intentar la inyección.

---

## Las tres rutas de inyección de CSS

### Ruta 1 — `hooks.content.register` (en cada carga de capítulo)

```js
rendition.hooks.content.register((contents) => {
    const head = contents.document.head;
    let sStyle = head.querySelector('#shark-styles');
    if (!sStyle) {
        sStyle = contents.document.createElement('style');
        sStyle.id = 'shark-styles';
        head.appendChild(sStyle);
    }
    sStyle.textContent = buildSharkCss(stylesRef.current); // siempre actualiza
});
```

Se ejecuta cuando epub.js carga/parsea un nuevo capítulo. **Siempre sobreescribe** `#shark-styles` (aunque ya exista) para asegurar que cambios previos del usuario queden aplicados. **Error anterior**: el código usaba `if (!head.querySelector('#shark-styles'))` — esto impedía actualizar estilos cuando ya existían tras un `re-display`.

### Ruta 2 — `useEffect` de tipografía (en cada cambio de settings)

```js
useEffect(() => {
    const opts = { fontFamily, fontSize, lineHeight, pageMargins, ... };
    stylesRef.current = opts; // actualiza ref primero
    if (!renditionRef.current || !isReady) return;

    const css = buildSharkCss(opts);
    const injectIntoDoc = (doc) => { /* crea/actualiza #shark-styles */ };

    // Intento 1: epub.js getContents()
    let injected = false;
    try {
        const contents = renditionRef.current.getContents();
        if (contents?.length > 0) {
            contents.forEach(c => injectIntoDoc(c.document));
            injected = true;
        }
    } catch (e) {}

    // Intento 2: DOM directo (cuando getContents() devuelve array vacío)
    if (!injected && viewerRef.current) {
        viewerRef.current.querySelectorAll('iframe').forEach(iframe => {
            try { injectIntoDoc(iframe.contentDocument || iframe.contentWindow?.document); injected = true; }
            catch (e) {}
        });
    }

    // Intento 3: forzar re-display (el hook inyectará al cargar)
    if (!injected) {
        renditionRef.current.display(loc?.start?.cfi || undefined).catch(() => {});
    }
}, [fontFamily, fontSize, lineHeight, pageMargins, customBg, textJustify,
    firstLineIndent, letterSpacing, hyphenation, paragraphSpacing, isReady]);
```

**Por qué tres intentos**: `getContents()` de epub.js puede devolver un array vacío si el visor aún no está completamente inicializado. El fallback de iframes accede al DOM directamente — más robusto. El último fallback fuerza una recarga que dispara el hook (Ruta 1).

**`pageMargins` debe estar en el array de dependencias** — fue un bug crítico que lo excluía, haciendo que el slider de márgenes no tuviese efecto.

### Ruta 3 — `relocated` (en cada vuelta de página)

```js
rendition.on('relocated', (location) => {
    // ... lógica de progreso ...
    // Re-inyecta estilos con el estado más reciente
    try {
        const css = buildSharkCss(stylesRef.current);
        renditionRef.current.getContents().forEach(c => {
            if (!c?.document?.head) return;
            let el = c.document.head.querySelector('#shark-styles');
            if (!el) { el = c.document.createElement('style'); el.id = 'shark-styles'; c.document.head.appendChild(el); }
            el.textContent = css;
        });
    } catch (e) {}
});
```

Garantía final: aunque las dos rutas anteriores fallen, el próximo cambio de página siempre re-aplica los estilos correctos.

---

## Otras inyecciones CSS del hook

Además de `#shark-styles`, el hook inyecta en cada iframe:

| ID | Contenido |
|---|---|
| `#shark-fonts` | `@import` de Google Fonts + `@font-face` de OpenDyslexic |
| `#shark-pagination` | Reglas de calidad tipográfica: `orphans`, `widows`, `break-after: avoid` en headings |
| `#shark-scroll` | Solo en modo scroll: elimina `page-break-*` de todos los elementos |

Estas tres solo se crean si no existen (`if (!head.querySelector(...))`), porque su contenido no cambia nunca durante la sesión.

---

## Cómo epub.js renderiza el libro

```
book = ePub()
book.open(arrayBuffer)           // carga el EPUB desde ArrayBuffer (NO desde File/Blob)
rendition = book.renderTo(div, options)
rendition.display(cfi)           // muestra el capítulo/posición
```

**Crítico**: epub.js requiere `ArrayBuffer`, no `File` ni `Blob`. Si se le pasa un `File`, el `open()` puede colgar indefinidamente sin rechazar la promesa. Siempre hacer:

```js
const arrayBuf = await file.arrayBuffer();
await book.open(arrayBuf);
```

### Opciones del rendition

```js
book.renderTo(viewerRef.current, {
    width: "100%",
    height: "100%",
    spread: readLayout,      // 'none' = una página, 'auto' = dos páginas
    manager: "continuous",
    flow: readFlow,          // 'paginated' o 'scrolled-doc'
    allowScriptedContent: true
})
```

### Modo spread (dos páginas)

Cuando `readLayout === 'auto'`, epub.js gestiona internamente dos columnas. En este modo:
- El `maxWidth` del contenedor debe duplicarse: `colPx * 2 + 80`
- No se añade `padding` extra desde el tema de epub.js (interfiere con su layout interno)
- Los estilos de `body { padding-left/right }` sí se aplican desde `buildSharkCss`

---

## Ancho de columna (`columnWidth`)

```js
const colPx = { narrow: 640, normal: 760, wide: 960 };
const isSpread = readFlow === 'paginated' && readLayout === 'auto';
const maxWidthStr = isSpread
    ? `${(colPx[columnWidth] || 760) * 2 + 80}px`
    : `${colPx[columnWidth] || 760}px`;
```

Este valor se aplica al contenedor `#viewer` como `maxWidth`. Cambiar `columnWidth` no actualiza el CSS del iframe — solo el contenedor React cambia de tamaño. Para que epub.js reflote el contenido hay un `useEffect` separado:

```js
useEffect(() => {
    // Fuerza reflow de epub.js cuando cambia el ancho del contenedor
    requestAnimationFrame(() => requestAnimationFrame(() => {
        renditionRef.current?.display(currentCfi || undefined).catch(() => {});
    }));
}, [columnWidth, isReady]);
```

El doble `requestAnimationFrame` asegura que React haya hecho flush del DOM con el nuevo `maxWidth` antes de que epub.js mida el contenedor.

---

## Caché de locations (`locationsCache.js`)

`book.locations.generate(1024)` es una operación costosa (puede tardar 2–5s en libros grandes). Se cachea en una IndexedDB separada (`SharkLocationsCache`):

```js
getCachedLocations(bookId)  // → null si no existe
setCachedLocations(bookId, locations)
clearCachedLocations(bookId)
```

Flujo:
1. Al abrir un libro, se busca en cache.
2. Si existe: `book.locations.load(cached)` — instantáneo.
3. Si no: `book.locations.generate(1024)` → guardar en cache.

---

## Eventos epub.js usados

| Evento | Cuándo dispara | Uso en SharkReader |
|---|---|---|
| `hooks.content.register` | Al cargar/parsear cada capítulo | Inyección CSS, listeners de wheel/keydown |
| `relocated` | Tras cada cambio de página/posición | Actualizar progreso, CFI, stats, re-inyectar CSS |
| `selected` | Al seleccionar texto | Dictionary popup, highlights, vocabulario |
| `click` | Clic dentro del iframe | Cerrar paneles, toggle toolbar en fullscreen |
| `markClicked` | Clic en un highlight | Confirmar eliminación del subrayado |

---

## Fullscreen

El fullscreen usa la Web API estándar (`document.documentElement.requestFullscreen()`), no el modo fullscreen de Electron. En fullscreen se oculta el sistema de pestañas y se muestran dos botones flotantes (cerrar y salir de fullscreen) en las esquinas superiores, con `pointer-events-none` en el contenedor para no interceptar clics en el epub.

---

## Notas de debugging

- Si los estilos no se aplican: abrir DevTools de Electron → inspeccionar los iframes → buscar `#shark-styles` en el `<head>` del iframe.
- Si `getContents()` devuelve vacío siempre: verificar que `isReady` es `true` y que `renditionRef.current` tiene el visor montado.
- Si el libro no carga: verificar que `fileData` es `ArrayBuffer` antes de `book.open()`.
- Si el progreso salta hacia atrás: es el clamping en `relocated` — solo va hacia atrás si la diferencia es >8% o si la navegación es explícitamente `'prev'`.
