# Arquitectura

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Shell de escritorio | Electron | 41.x |
| Bundler | Vite + `@vitejs/plugin-react` | 8.x |
| UI framework | React | 19.x |
| Estilos | Tailwind CSS (CDN) + `styles/main.css` | — |
| Lector EPUB | epub.js (`epubjs`) | 0.3.93 |
| Lector PDF | PDF.js (`pdfjs-dist`) | 5.x |
| Empaquetado | electron-builder | 26.x |
| Almacenamiento | IndexedDB (archivos) + localStorage (metadatos) | nativo |

> **Nota sobre Babel Standalone:** en el entorno de desarrollo original las vistas se compilaban con Babel en runtime; la versión actual usa Vite + JSX en build-time, lo que elimina esa dependencia en producción.

---

## Estructura de archivos

```
SharkReader-main/
├── main.js                  # Main Process de Electron
├── index.html               # HTML raíz (referencia a src/main.jsx)
├── vite.config.js           # Configuración de Vite
├── package.json
│
├── scripts/
│   └── dev.cjs              # Launcher de desarrollo (Vite + Electron)
│
├── src/
│   ├── main.jsx             # Punto de entrada React (ReactDOM.createRoot)
│   ├── App.jsx              # Componente raíz — estado global, router de vistas
│   │
│   ├── hooks/
│   │   └── useBooks.js      # Hook de gestión de biblioteca
│   │
│   ├── db.js                # IndexedDB helpers + migración legacy
│   ├── achievements.js      # Definiciones de logros y rarities
│   ├── translations.js      # Literales ES/EN
│   ├── icons.jsx            # Colección de SVG inline
│   │
│   ├── EpubReader.jsx       # Lector EPUB completo
│   ├── PdfReader.jsx        # Lector PDF
│   ├── AnalyticsView.jsx    # Dashboard de estadísticas
│   ├── SettingsPanel.jsx    # Panel de ajustes
│   ├── WorkshopPanel.jsx    # Panel de addons
│   ├── UserMenu.jsx         # Menú lateral de usuario
│   └── GoodreadsImport.jsx  # Importador de lista Goodreads
│
├── styles/
│   └── main.css             # Variables CSS, temas, animaciones de página
│
├── Docs/                    # Esta documentación
│
├── dist-renderer/           # Output de Vite (generado con npm run build:renderer)
└── dist/                    # Instaladores finales (generado con npm run build)
```

---

## Flujo de arranque

### Desarrollo (`npm start`)

```
scripts/dev.cjs
  │
  ├─ Borra ELECTRON_RUN_AS_NODE (workaround VS Code)
  ├─ Lanza: npx vite --port 5173
  ├─ Poll HTTP hasta que Vite responde en localhost:5173
  └─ Lanza: electron . con VITE_DEV=1
              │
              └─ main.js → createWindow()
                    └─ mainWindow.loadURL('http://localhost:5173')
                          └─ src/main.jsx → <App />
```

### Producción

```
npm run build
  ├─ vite build → dist-renderer/
  └─ electron-builder --win nsis portable → dist/
        └─ Empaqueta: main.js + dist-renderer/ + node_modules
```

En producción, `main.js` carga `dist-renderer/index.html` en lugar del servidor Vite.

---

## Procesos de Electron

### Main Process (`main.js`)

Responsabilidades:
- Crear y gestionar `BrowserWindow`
- Prevención de instancias múltiples (`app.requestSingleInstanceLock`)
- Apertura de archivos desde el sistema de archivos o asociaciones de archivo
- Handlers IPC (ver [ipc-electron.md](ipc-electron.md))
- Registro de asociaciones de archivo en el Registro de Windows

### Renderer Process (`src/`)

Toda la lógica de la aplicación corre en el Renderer como una SPA React. El renderer usa directamente las APIs web estándar (IndexedDB, localStorage, File API, Notification API) y se comunica con el Main Process vía `window.require('electron').ipcRenderer` cuando necesita funciones nativas.

---

## Gestión de estado

El estado global reside en `App.jsx` como estado React local (no hay store externo). Se pasa hacia los componentes hijos vía props. Los datos persistentes se sincronizan con localStorage en efectos (`useEffect`).

| Dato | Almacenamiento |
|---|---|
| Archivos de los libros (blob) | IndexedDB `files` store |
| Metadatos de cada libro | `localStorage` clave `sharkreader_meta` |
| Configuración del usuario | `localStorage` claves individuales |
| Progreso de lectura | `localStorage` dentro de `sharkreader_meta` |
| Vocabulario | `localStorage` clave `sharkreader_vocab` |
| Reading Journal | `localStorage` clave `sharkreader_journal` |
| Logros desbloqueados | `localStorage` clave `sharkreader_achievements` |
| Estado addons Workshop | `localStorage` clave `sharkreader_addons` |
