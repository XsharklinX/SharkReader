# SharkReader â€” Handoff para IA

> Estado del proyecto al 11/05/2025. Lee esto antes de cualquier otra cosa.

---

## QuÃ© es este proyecto

**SharkReader** es una app de escritorio Windows para leer EPUB y PDF. Stack:

- **Electron 41** (shell + IPC)
- **Vite 8 + React 19** (renderer, JSX compilado en build-time)
- **epub.js 0.3.93** (lector EPUB)
- **pdfjs-dist 5.x** (lector PDF)
- **Tailwind CSS** (CDN, sin PostCSS/build step)
- **IndexedDB** (archivos binarios) + **localStorage** (metadatos)

```
pnpm start        # desarrollo: lanza Vite en :5173 + Electron apuntando a Ã©l
pnpm build    # producciÃ³n: build Vite â†’ dist-renderer/ + electron-builder â†’ dist/
```

El workaround crÃ­tico del entorno de desarrollo: `scripts/dev.cjs` elimina `ELECTRON_RUN_AS_NODE` antes de lanzar Electron porque VS Code lo inyecta y rompe `require('electron')`.

---

## Estructura de archivos importantes

```
src/
â”œâ”€â”€ App.jsx              â† Estado global, biblioteca, tabs, import de libros
â”œâ”€â”€ EpubReader.jsx       â† Lector EPUB completo (el archivo mÃ¡s complejo)
â”œâ”€â”€ PdfReader.jsx        â† Lector PDF
â”œâ”€â”€ db.js                â† IndexedDB helpers
â”œâ”€â”€ locationsCache.js    â† Cache de epub.js locations en IDB separada
â”œâ”€â”€ achievements.js      â† Definiciones de logros
â”œâ”€â”€ translations.js      â† Strings ES/EN
â”œâ”€â”€ WorkshopPanel.jsx    â† Sistema de addons
â”œâ”€â”€ AnalyticsView.jsx    â† Dashboard de estadÃ­sticas
â”œâ”€â”€ SettingsPanel.jsx    â† Panel de ajustes
â””â”€â”€ hooks/useBooks.js    â† DEAD CODE â€” no se usa, nunca se llama
```

---

## Estado actual del cÃ³digo (quÃ© estÃ¡ resuelto, quÃ© no)

### âœ… Resuelto en la Ãºltima sesiÃ³n

#### 1. Panel Aa (tipografÃ­a) â€” no aplicaba ningÃºn cambio

**Problema**: epub.js renderiza cada capÃ­tulo en un `<iframe>` aislado. El CSS del renderer React no penetra en el iframe. La funciÃ³n `buildSharkCss()` generaba el CSS correcto pero la inyecciÃ³n fallaba por tres razones:

1. `hooks.content.register` tenÃ­a `if (!head.querySelector('#shark-styles'))` â€” solo creaba el tag, nunca lo actualizaba. En re-displays el tag ya existÃ­a y los cambios del usuario se ignoraban.
2. `pageMargins` no estaba en el array de dependencias del `useEffect` de tipografÃ­a â€” el slider de mÃ¡rgenes no disparaba la inyecciÃ³n.
3. `pageMargins` no se pasaba a `buildSharkCss()` â€” la funciÃ³n no lo incluÃ­a en el CSS generado.

**Fix aplicado**:
- `hooks.content.register` ahora siempre sobreescribe `sStyle.textContent` (sin el `if`).
- `buildSharkCss` ahora acepta y usa `pageMargins` â†’ `body { padding-left/right: Xpx !important }`.
- El `useEffect` incluye `pageMargins` en deps y en `opts`.
- Se aÃ±adiÃ³ fallback de inyecciÃ³n directa via `viewerRef.current.querySelectorAll('iframe')` cuando `getContents()` devuelve vacÃ­o.

Ver [epub-reader-internals.md](epub-reader-internals.md) para la explicaciÃ³n completa del sistema.

#### 2. Importar libros â€” loading infinito

**Problema**: `processFiles` aÃ±adÃ­a los libros como `loading: true`, los procesaba secuencialmente, y solo los ponÃ­a a `loading: false` al final. Si cualquier `epub.open()` se colgaba (lo cual pasa con algunos EPUBs malformados), todos los libros siguientes quedaban atascados para siempre.

**Fix aplicado** (en `App.jsx`, funciÃ³n `processFiles`):
- Los libros se aÃ±aden **inmediatamente** al estado con `loading: false` y el nombre del archivo como tÃ­tulo provisional.
- Se guardan en IndexedDB al instante.
- La extracciÃ³n de metadatos (portada, tÃ­tulo real, autor) ocurre en un IIFE `async` independiente por libro, completamente no-bloqueante.
- `raceTimeout(promise, ms, fallback)` envuelve cada operaciÃ³n asÃ­ncrona para que ninguna pueda colgar mÃ¡s de N segundos.

#### 3. Fullscreen â€” la barra de tÃ­tulo cubrÃ­a el libro

**Fix**: En fullscreen el header y tabs se ocultan completamente. Solo aparecen dos botones flotantes pequeÃ±os (cerrar / salir fullscreen) en las esquinas superiores con `pointer-events-none` en su contenedor para no capturar eventos del epub.

---

### âš ï¸ Pendiente de confirmar

- **Panel Aa**: El fix estÃ¡ aplicado. El usuario no confirmÃ³ que funcione en la build actual porque cambiÃ³ de herramienta. Probar al retomar.

---

### âŒ Dead code conocido

- `src/hooks/useBooks.js` â€” el hook estÃ¡ importado en `App.jsx` pero `useBooks()` nunca se llama. La funciÃ³n `processFiles` de ese hook es cÃ³digo muerto. No borrar sin revisar si hay algÃºn efecto side-effect al importar.

---

## Flujo de datos crÃ­ticos

### CÃ³mo se importa un libro

```
Usuario arrastra/selecciona archivo(s)
  â”‚
  â”œâ”€ processFiles(files)
  â”‚     â”œâ”€ Filtra: solo .epub y .pdf
  â”‚     â”œâ”€ Crea objeto book con id Ãºnico, loading: false
  â”‚     â”œâ”€ setBooks(prev => [...prev, ...newBooks])  â† aparece inmediatamente en UI
  â”‚     â”œâ”€ saveFileToDB(...)                          â† persiste en IDB
  â”‚     â””â”€ Por cada EPUB: IIFE async (no bloquea)
  â”‚           â”œâ”€ file.arrayBuffer() con timeout 8s
  â”‚           â”œâ”€ ePub().open(arrayBuf) con timeout 10s
  â”‚           â”œâ”€ tmp.coverUrl() + tmp.loaded.metadata con timeout 5s
  â”‚           â””â”€ setBooks(prev => prev.map(...))     â† actualiza con metadatos reales
  â”‚
  â””â”€ IndexedDB: archivos en store 'files', versiÃ³n 3
```

### CÃ³mo se persisten los metadatos

Hay dos sistemas de persistencia que conviven:

1. **`localStorage['sharkreader_meta']`**: objeto `{ "TÃ­tulo|Autor": { progress, lastLocation, bookmarks, ... } }`. Se escribe en un `useEffect` con debounce de 2000ms cada vez que cambia `books[]`.

2. **IndexedDB `appData` store**: para datos pesados (stats, journal, vocabulary) que superarÃ­an el lÃ­mite de localStorage. Se leen al inicio con `loadAppData()` y se escriben con `saveAppData()`.

### CÃ³mo se aplican los estilos al EPUB

```
Estado React cambia (ej: setFontFamily('Georgia'))
  â”‚
  â””â”€ useEffect [fontFamily, ..., pageMargins, isReady]
        â”œâ”€ stylesRef.current = { fontFamily, ..., pageMargins }
        â”œâ”€ css = buildSharkCss(opts)
        â”œâ”€ Intento 1: rendition.getContents() â†’ inyectar en cada doc
        â”œâ”€ Intento 2: querySelectorAll('iframe') â†’ inyectar en cada iframe
        â””â”€ Intento 3: rendition.display() â†’ dispara hooks.content.register

hooks.content.register (en cada carga de capÃ­tulo):
  â””â”€ Siempre sobreescribe #shark-styles con buildSharkCss(stylesRef.current)

relocated event (en cada vuelta de pÃ¡gina):
  â””â”€ Siempre sobreescribe #shark-styles con buildSharkCss(stylesRef.current)
```

---

## IndexedDB â€” esquema actual

**DB `SharkReaderDB` versiÃ³n 3**

| Store | KeyPath | Contenido |
|---|---|---|
| `files` | `id` | `{ id, file (Blob), coverBase64, originalTitle, originalAuthor, dateAdded }` |
| `appData` | `key` | `{ key, value }` â€” stats, journal, vocabulary |

**DB `SharkLocationsCache` versiÃ³n 1**

| Store | KeyPath | Contenido |
|---|---|---|
| `locations` | `bookId` | `{ bookId, locations (array), cachedAt }` |

La DB antigua `SharkReaderDB_v4` se migra automÃ¡ticamente en el primer arranque y luego se ignora.

> **Nota**: `data-layer.md` dice versiÃ³n 2 â€” estÃ¡ desactualizado. La versiÃ³n real es 3 (aÃ±ade el store `appData`).

---

## IPC Electron (window.electronAPI)

Expuesto via `contextBridge` en `preload.js`:

| MÃ©todo | DescripciÃ³n |
|---|---|
| `pickFolder()` | Abre diÃ¡logo nativo para seleccionar carpeta |
| `writeSyncFile(folder, content)` | Escribe `sharkreader_sync.json` en la carpeta |
| `readSyncFile(folder)` | Lee el archivo de sync |
| `registerFileAssociations()` | Asocia `.epub` y `.pdf` a la app en el Registry |
| `removeFileAssociations()` | Elimina las asociaciones |
| `onOpenFile(handler)` | Listener: cuando el usuario abre un archivo desde el explorador |
| `offOpenFile()` | Elimina el listener |

`webSecurity: false` estÃ¡ configurado en `main.js` para permitir `fetch` a URLs `file://` y acceso cross-frame a iframes de epub.js.

---

## Sistema de addons (Workshop)

Los addons son flags booleanos en `localStorage['sharkreader_addons']`. No son mÃ³dulos que se cargan dinÃ¡micamente â€” son `if (addons.focusMode)` en el cÃ³digo existente.

Addons actuales:

| ID | DÃ³nde afecta | Efecto |
|---|---|---|
| `focusMode` | Reader | Oculta toolbar tras 2.5s inactividad |
| `autoBookmark` | Reader | Guarda posiciÃ³n al cerrar libro |
| `netflixView` | Library | Portadas grandes con hover |
| `readingJournal` | Global | Registro de sesiones |
| `reminders` | Global | NotificaciÃ³n recordatorio |
| `smartToc` | Reader | TOC flotante con indicador de posiciÃ³n |

Para aÃ±adir un nuevo addon: (1) aÃ±adir objeto al array `ADDONS` en `WorkshopPanel.jsx`, (2) usar `addons.miAddon` en el componente donde aplique.

---

## Temas y CSS variables

El tema se aplica cambiando `document.body.className = 'theme-dark'` (o `light`, `sepia`). Las variables CSS estÃ¡n en `styles/main.css`:

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

2. **El CSS de React no afecta el interior del epub**. Todo estilo del lector va a travÃ©s de `buildSharkCss` + inyecciÃ³n en el iframe.

3. **`hooks.content.register` se registra una vez**. Los callbacks no capturan estado React â€” usan `stylesRef.current` (un `useRef`) para acceder al estado actual.

4. **`getContents()` puede devolver vacÃ­o** incluso cuando el libro estÃ¡ renderizado. Siempre tener el fallback de `querySelectorAll('iframe')`.

5. **`useBooks.js` es dead code**. EstÃ¡ importado pero su funciÃ³n no se invoca. No confiar en Ã©l.

6. **La persistencia tiene debounce**. Los cambios en `books[]` no se persisten inmediatamente â€” hay un timeout de 2000ms. En tests o debugging, esperar antes de verificar localStorage.

7. **`sharkreader_meta` usa `"tÃ­tulo|autor"` como clave**. Si el tÃ­tulo o el autor cambia, se crea una entrada nueva y la vieja queda huÃ©rfana.

8. **El sistema de pestaÃ±as (`tabs`)** es un array de `{ id, bookId, type }` en `App.jsx`. El lector activo se determina por `activeTabId`. Cada pestaÃ±a abre su propio `EpubReader` montado independientemente.

9. **`ELECTRON_RUN_AS_NODE`** debe estar desactivado para desarrollo. `scripts/dev.cjs` lo hace automÃ¡ticamente. Si lanzas `electron .` directamente desde un terminal de VS Code, fallarÃ¡.

---

## Recomendaciones para trabajar con Codex u otra IA

- **Dar contexto de archivo especÃ­fico**: decir "en `EpubReader.jsx`, en el `useEffect` de tipografÃ­a" es mucho mÃ¡s efectivo que "en el lector".
- **El problema de CSS en epub**: si algo relacionado con estilos no funciona, la causa casi siempre estÃ¡ en la cadena de inyecciÃ³n (`buildSharkCss` â†’ hook â†’ useEffect â†’ relocated). Revisar en ese orden.
- **Pedir verificaciÃ³n de tipos**: epub.js no tiene tipos TypeScript. Muchas propiedades pueden ser `null`/`undefined` dependiendo del estado. Usar `?.` en todas las cadenas de acceso a epub.js.
- **No usar `epub.js` themes API para estilos permanentes**: `rendition.themes.font()`, `themes.fontSize()` y `themes.override()` aplican estilos inline en `html` que el CSS propio del libro puede sobreescribir. La inyecciÃ³n de `<style !important>` es el mÃ©todo correcto.
- **Probar con mÃºltiples EPUBs**: algunos EPUBs tienen CSS muy agresivo con `!important`. Otros tienen `html { font-size: 62.5% }`. Otros tienen iframes anidados. El comportamiento varÃ­a mucho entre libros.

