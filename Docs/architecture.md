# Arquitectura

## Stack tecnolÃ³gico

| Capa | TecnologÃ­a | VersiÃ³n |
|---|---|---|
| Shell de escritorio | Electron | 41.x |
| Bundler | Vite + `@vitejs/plugin-react` | 8.x |
| UI framework | React | 19.x |
| Estilos | Tailwind CSS (CDN) + `styles/main.css` | â€” |
| Lector EPUB | epub.js (`epubjs`) | 0.3.93 |
| Lector PDF | PDF.js (`pdfjs-dist`) | 5.x |
| Empaquetado | electron-builder | 26.x |
| Almacenamiento | IndexedDB (archivos) + localStorage (metadatos) | nativo |

> **Nota sobre Babel Standalone:** en el entorno de desarrollo original las vistas se compilaban con Babel en runtime; la versiÃ³n actual usa Vite + JSX en build-time, lo que elimina esa dependencia en producciÃ³n.

---

## Estructura de archivos

```
SharkReader-main/
â”œâ”€â”€ main.js                  # Main Process de Electron
â”œâ”€â”€ index.html               # HTML raÃ­z (referencia a src/main.jsx)
â”œâ”€â”€ vite.config.js           # ConfiguraciÃ³n de Vite
â”œâ”€â”€ package.json
â”‚
â”œâ”€â”€ scripts/
â”‚   â””â”€â”€ dev.cjs              # Launcher de desarrollo (Vite + Electron)
â”‚
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ main.jsx             # Punto de entrada React (ReactDOM.createRoot)
â”‚   â”œâ”€â”€ App.jsx              # Componente raÃ­z â€” estado global, router de vistas
â”‚   â”‚
â”‚   â”œâ”€â”€ hooks/
â”‚   â”‚   â””â”€â”€ useBooks.js      # Hook de gestiÃ³n de biblioteca
â”‚   â”‚
â”‚   â”œâ”€â”€ db.js                # IndexedDB helpers + migraciÃ³n legacy
â”‚   â”œâ”€â”€ achievements.js      # Definiciones de logros y rarities
â”‚   â”œâ”€â”€ translations.js      # Literales ES/EN
â”‚   â”œâ”€â”€ icons.jsx            # ColecciÃ³n de SVG inline
â”‚   â”‚
â”‚   â”œâ”€â”€ EpubReader.jsx       # Lector EPUB completo
â”‚   â”œâ”€â”€ PdfReader.jsx        # Lector PDF
â”‚   â”œâ”€â”€ AnalyticsView.jsx    # Dashboard de estadÃ­sticas
â”‚   â”œâ”€â”€ SettingsPanel.jsx    # Panel de ajustes
â”‚   â”œâ”€â”€ WorkshopPanel.jsx    # Panel de addons
â”‚   â”œâ”€â”€ UserMenu.jsx         # MenÃº lateral de usuario
â”‚   â””â”€â”€ GoodreadsImport.jsx  # Importador de lista Goodreads
â”‚
â”œâ”€â”€ styles/
â”‚   â””â”€â”€ main.css             # Variables CSS, temas, animaciones de pÃ¡gina
â”‚
â”œâ”€â”€ Docs/                    # Esta documentaciÃ³n
â”‚
â”œâ”€â”€ dist-renderer/           # Output de Vite (generado con pnpm build:renderer)
â””â”€â”€ dist/                    # Instaladores finales (generado con pnpm build)
```

---

## Flujo de arranque

### Desarrollo (`pnpm start`)

```
scripts/dev.cjs
  â”‚
  â”œâ”€ Borra ELECTRON_RUN_AS_NODE (workaround VS Code)
  â”œâ”€ Lanza: npx vite --port 5173
  â”œâ”€ Poll HTTP hasta que Vite responde en localhost:5173
  â””â”€ Lanza: electron . con VITE_DEV=1
              â”‚
              â””â”€ main.js â†’ createWindow()
                    â””â”€ mainWindow.loadURL('http://localhost:5173')
                          â””â”€ src/main.jsx â†’ <App />
```

### ProducciÃ³n

```
pnpm build
  â”œâ”€ vite build â†’ dist-renderer/
  â””â”€ electron-builder --win nsis portable â†’ dist/
        â””â”€ Empaqueta: main.js + dist-renderer/ + node_modules
```

En producciÃ³n, `main.js` carga `dist-renderer/index.html` en lugar del servidor Vite.

---

## Procesos de Electron

### Main Process (`main.js`)

Responsabilidades:
- Crear y gestionar `BrowserWindow`
- PrevenciÃ³n de instancias mÃºltiples (`app.requestSingleInstanceLock`)
- Apertura de archivos desde el sistema de archivos o asociaciones de archivo
- Handlers IPC (ver [ipc-electron.md](ipc-electron.md))
- Registro de asociaciones de archivo en el Registro de Windows

### Renderer Process (`src/`)

Toda la lÃ³gica de la aplicaciÃ³n corre en el Renderer como una SPA React. El renderer usa directamente las APIs web estÃ¡ndar (IndexedDB, localStorage, File API, Notification API) y se comunica con el Main Process vÃ­a `window.require('electron').ipcRenderer` cuando necesita funciones nativas.

---

## GestiÃ³n de estado

El estado global reside en `App.jsx` como estado React local (no hay store externo). Se pasa hacia los componentes hijos vÃ­a props. Los datos persistentes se sincronizan con localStorage en efectos (`useEffect`).

| Dato | Almacenamiento |
|---|---|
| Archivos de los libros (blob) | IndexedDB `files` store |
| Metadatos de cada libro | `localStorage` clave `sharkreader_meta` |
| ConfiguraciÃ³n del usuario | `localStorage` claves individuales |
| Progreso de lectura | `localStorage` dentro de `sharkreader_meta` |
| Vocabulario | `localStorage` clave `sharkreader_vocab` |
| Reading Journal | `localStorage` clave `sharkreader_journal` |
| Logros desbloqueados | `localStorage` clave `sharkreader_achievements` |
| Estado addons Workshop | `localStorage` clave `sharkreader_addons` |

