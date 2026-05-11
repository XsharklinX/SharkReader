# SharkReader — Handoff para IA

> Estado del proyecto al 11/05/2025. Lee esto antes de cualquier otra cosa.

---

## Qué es este proyecto

**SharkReader** es una app de escritorio Windows para leer EPUB y PDF. Stack:

- **Electron 41** (shell + IPC)
- **Vite 8 + React 19** (renderer, JSX compilado en build-time)
- **epub.js 0.3.93** (lector EPUB)
- **pdfjs-dist 5.x** (lector PDF)
- **Tailwind CSS** (CDN, sin PostCSS/build step)
- **IndexedDB** (archivos binarios) + **localStorage** (metadatos)

```
npm start        # desarrollo: lanza Vite en :5173 + Electron apuntando a él
npm run build    # producción: build Vite → dist-renderer/ + electron-builder → dist/
```

El workaround crítico del entorno de desarrollo: `scripts/dev.cjs` elimina `ELECTRON_RUN_AS_NODE` antes de lanzar Electron porque VS Code lo inyecta y rompe `require('electron')`.

---

## Estructura de archivos importantes

```
src/
├── App.jsx              ← Estado global, biblioteca, tabs, import de libros
├── EpubReader.jsx       ← Lector EPUB completo (el archivo más complejo)
├── PdfReader.jsx        ← Lector PDF
├── db.js                ← IndexedDB helpers
├── locationsCache.js    ← Cache de epub.js locations en IDB separada
├── achievements.js      ← Definiciones de logros
├── translations.js      ← Strings ES/EN
├── WorkshopPanel.jsx    ← Sistema de addons
├── AnalyticsView.jsx    ← Dashboard de estadísticas
├── SettingsPanel.jsx    ← Panel de ajustes
└── hooks/useBooks.js    ← DEAD CODE — no se usa, nunca se llama
```

---

## Estado actual del código (qué está resuelto, qué no)

### ✅ Resuelto en la última sesión

#### 1. Panel Aa (tipografía) — no aplicaba ningún cambio

**Problema**: epub.js renderiza cada capítulo en un `<iframe>` aislado. El CSS del renderer React no penetra en el iframe. La función `buildSharkCss()` generaba el CSS correcto pero la inyección fallaba por tres razones:

1. `hooks.content.register` tenía `if (!head.querySelector('#shark-styles'))` — solo creaba el tag, nunca lo actualizaba. En re-displays el tag ya existía y los cambios del usuario se ignoraban.
2. `pageMargins` no estaba en el array de dependencias del `useEffect` de tipografía — el slider de márgenes no disparaba la inyección.
3. `pageMargins` no se pasaba a `buildSharkCss()` — la función no lo incluía en el CSS generado.

**Fix aplicado**:
- `hooks.content.register` ahora siempre sobreescribe `sStyle.textContent` (sin el `if`).
- `buildSharkCss` ahora acepta y usa `pageMargins` → `body { padding-left/right: Xpx !important }`.
- El `useEffect` incluye `pageMargins` en deps y en `opts`.
- Se añadió fallback de inyección directa via `viewerRef.current.querySelectorAll('iframe')` cuando `getContents()` devuelve vacío.

Ver [epub-reader-internals.md](epub-reader-internals.md) para la explicación completa del sistema.

#### 2. Importar libros — loading infinito

**Problema**: `processFiles` añadía los libros como `loading: true`, los procesaba secuencialmente, y solo los ponía a `loading: false` al final. Si cualquier `epub.open()` se colgaba (lo cual pasa con algunos EPUBs malformados), todos los libros siguientes quedaban atascados para siempre.

**Fix aplicado** (en `App.jsx`, función `processFiles`):
- Los libros se añaden **inmediatamente** al estado con `loading: false` y el nombre del archivo como título provisional.
- Se guardan en IndexedDB al instante.
- La extracción de metadatos (portada, título real, autor) ocurre en un IIFE `async` independiente por libro, completamente no-bloqueante.
- `raceTimeout(promise, ms, fallback)` envuelve cada operación asíncrona para que ninguna pueda colgar más de N segundos.

#### 3. Fullscreen — la barra de título cubría el libro

**Fix**: En fullscreen el header y tabs se ocultan completamente. Solo aparecen dos botones flotantes pequeños (cerrar / salir fullscreen) en las esquinas superiores con `pointer-events-none` en su contenedor para no capturar eventos del epub.

---

### ⚠️ Pendiente de confirmar

- **Panel Aa**: El fix está aplicado. El usuario no confirmó que funcione en la build actual porque cambió de herramienta. Probar al retomar.

---

### ❌ Dead code conocido

- `src/hooks/useBooks.js` — el hook está importado en `App.jsx` pero `useBooks()` nunca se llama. La función `processFiles` de ese hook es código muerto. No borrar sin revisar si hay algún efecto side-effect al importar.

---

## Flujo de datos críticos

### Cómo se importa un libro

```
Usuario arrastra/selecciona archivo(s)
  │
  ├─ processFiles(files)
  │     ├─ Filtra: solo .epub y .pdf
  │     ├─ Crea objeto book con id único, loading: false
  │     ├─ setBooks(prev => [...prev, ...newBooks])  ← aparece inmediatamente en UI
  │     ├─ saveFileToDB(...)                          ← persiste en IDB
  │     └─ Por cada EPUB: IIFE async (no bloquea)
  │           ├─ file.arrayBuffer() con timeout 8s
  │           ├─ ePub().open(arrayBuf) con timeout 10s
  │           ├─ tmp.coverUrl() + tmp.loaded.metadata con timeout 5s
  │           └─ setBooks(prev => prev.map(...))     ← actualiza con metadatos reales
  │
  └─ IndexedDB: archivos en store 'files', versión 3
```

### Cómo se persisten los metadatos

Hay dos sistemas de persistencia que conviven:

1. **`localStorage['sharkreader_meta']`**: objeto `{ "Título|Autor": { progress, lastLocation, bookmarks, ... } }`. Se escribe en un `useEffect` con debounce de 2000ms cada vez que cambia `books[]`.

2. **IndexedDB `appData` store**: para datos pesados (stats, journal, vocabulary) que superarían el límite de localStorage. Se leen al inicio con `loadAppData()` y se escriben con `saveAppData()`.

### Cómo se aplican los estilos al EPUB

```
Estado React cambia (ej: setFontFamily('Georgia'))
  │
  └─ useEffect [fontFamily, ..., pageMargins, isReady]
        ├─ stylesRef.current = { fontFamily, ..., pageMargins }
        ├─ css = buildSharkCss(opts)
        ├─ Intento 1: rendition.getContents() → inyectar en cada doc
        ├─ Intento 2: querySelectorAll('iframe') → inyectar en cada iframe
        └─ Intento 3: rendition.display() → dispara hooks.content.register

hooks.content.register (en cada carga de capítulo):
  └─ Siempre sobreescribe #shark-styles con buildSharkCss(stylesRef.current)

relocated event (en cada vuelta de página):
  └─ Siempre sobreescribe #shark-styles con buildSharkCss(stylesRef.current)
```

---

## IndexedDB — esquema actual

**DB `SharkReaderDB` versión 3**

| Store | KeyPath | Contenido |
|---|---|---|
| `files` | `id` | `{ id, file (Blob), coverBase64, originalTitle, originalAuthor, dateAdded }` |
| `appData` | `key` | `{ key, value }` — stats, journal, vocabulary |

**DB `SharkLocationsCache` versión 1**

| Store | KeyPath | Contenido |
|---|---|---|
| `locations` | `bookId` | `{ bookId, locations (array), cachedAt }` |

La DB antigua `SharkReaderDB_v4` se migra automáticamente en el primer arranque y luego se ignora.

> **Nota**: `data-layer.md` dice versión 2 — está desactualizado. La versión real es 3 (añade el store `appData`).

---

## IPC Electron (window.electronAPI)

Expuesto via `contextBridge` en `preload.js`:

| Método | Descripción |
|---|---|
| `pickFolder()` | Abre diálogo nativo para seleccionar carpeta |
| `writeSyncFile(folder, content)` | Escribe `sharkreader_sync.json` en la carpeta |
| `readSyncFile(folder)` | Lee el archivo de sync |
| `registerFileAssociations()` | Asocia `.epub` y `.pdf` a la app en el Registry |
| `removeFileAssociations()` | Elimina las asociaciones |
| `onOpenFile(handler)` | Listener: cuando el usuario abre un archivo desde el explorador |
| `offOpenFile()` | Elimina el listener |

`webSecurity: false` está configurado en `main.js` para permitir `fetch` a URLs `file://` y acceso cross-frame a iframes de epub.js.

---

## Sistema de addons (Workshop)

Los addons son flags booleanos en `localStorage['sharkreader_addons']`. No son módulos que se cargan dinámicamente — son `if (addons.focusMode)` en el código existente.

Addons actuales:

| ID | Dónde afecta | Efecto |
|---|---|---|
| `focusMode` | Reader | Oculta toolbar tras 2.5s inactividad |
| `autoBookmark` | Reader | Guarda posición al cerrar libro |
| `netflixView` | Library | Portadas grandes con hover |
| `readingJournal` | Global | Registro de sesiones |
| `reminders` | Global | Notificación recordatorio |
| `smartToc` | Reader | TOC flotante con indicador de posición |

Para añadir un nuevo addon: (1) añadir objeto al array `ADDONS` en `WorkshopPanel.jsx`, (2) usar `addons.miAddon` en el componente donde aplique.

---

## Temas y CSS variables

El tema se aplica cambiando `document.body.className = 'theme-dark'` (o `light`, `sepia`). Las variables CSS están en `styles/main.css`:

```css
/* Variables disponibles en toda la app */
--bg-color
--surface-bg
--text-color
--border-color
--highlight       /* color de acento, sobreescribible por el usuario */
--topbar-bg
--progress-bg
```

El color de acento se gestiona en `App.jsx`:

```js
root.style.setProperty('--highlight', accentColor.value);
```

---

## Gotchas importantes para cualquier IA

1. **epub.js necesita `ArrayBuffer`**, no `File` ni `Blob`. `book.open(file)` puede colgar sin rechazar nunca.

2. **El CSS de React no afecta el interior del epub**. Todo estilo del lector va a través de `buildSharkCss` + inyección en el iframe.

3. **`hooks.content.register` se registra una vez**. Los callbacks no capturan estado React — usan `stylesRef.current` (un `useRef`) para acceder al estado actual.

4. **`getContents()` puede devolver vacío** incluso cuando el libro está renderizado. Siempre tener el fallback de `querySelectorAll('iframe')`.

5. **`useBooks.js` es dead code**. Está importado pero su función no se invoca. No confiar en él.

6. **La persistencia tiene debounce**. Los cambios en `books[]` no se persisten inmediatamente — hay un timeout de 2000ms. En tests o debugging, esperar antes de verificar localStorage.

7. **`sharkreader_meta` usa `"título|autor"` como clave**. Si el título o el autor cambia, se crea una entrada nueva y la vieja queda huérfana.

8. **El sistema de pestañas (`tabs`)** es un array de `{ id, bookId, type }` en `App.jsx`. El lector activo se determina por `activeTabId`. Cada pestaña abre su propio `EpubReader` montado independientemente.

9. **`ELECTRON_RUN_AS_NODE`** debe estar desactivado para desarrollo. `scripts/dev.cjs` lo hace automáticamente. Si lanzas `electron .` directamente desde un terminal de VS Code, fallará.

---

## Recomendaciones para trabajar con Codex u otra IA

- **Dar contexto de archivo específico**: decir "en `EpubReader.jsx`, en el `useEffect` de tipografía" es mucho más efectivo que "en el lector".
- **El problema de CSS en epub**: si algo relacionado con estilos no funciona, la causa casi siempre está en la cadena de inyección (`buildSharkCss` → hook → useEffect → relocated). Revisar en ese orden.
- **Pedir verificación de tipos**: epub.js no tiene tipos TypeScript. Muchas propiedades pueden ser `null`/`undefined` dependiendo del estado. Usar `?.` en todas las cadenas de acceso a epub.js.
- **No usar `epub.js` themes API para estilos permanentes**: `rendition.themes.font()`, `themes.fontSize()` y `themes.override()` aplican estilos inline en `html` que el CSS propio del libro puede sobreescribir. La inyección de `<style !important>` es el método correcto.
- **Probar con múltiples EPUBs**: algunos EPUBs tienen CSS muy agresivo con `!important`. Otros tienen `html { font-size: 62.5% }`. Otros tienen iframes anidados. El comportamiento varía mucho entre libros.
