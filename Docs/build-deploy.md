# Build y Distribución

## Comandos

| Comando | Descripción |
|---|---|
| `npm start` | Modo desarrollo: lanza Vite en `:5173` y Electron apuntando a ese servidor |
| `npm run build:renderer` | Compila React con Vite → `dist-renderer/` |
| `npm run build` | Build completo: renderer + instaladores Windows en `dist/` |

---

## Flujo de desarrollo (`npm start`)

El script `scripts/dev.cjs` orquesta el arranque:

1. Borra `ELECTRON_RUN_AS_NODE` del entorno (fix necesario cuando se ejecuta desde VS Code, que inyecta esa variable y rompe la detección de Electron).
2. Arranca `npx vite --port 5173` como proceso hijo.
3. Hace polling a `http://localhost:5173` cada 300 ms (hasta 40 intentos = 12 s).
4. Cuando Vite responde, lanza `electron .` con `VITE_DEV=1` en el entorno.
5. Al cerrar Electron, mata el proceso Vite y sale con el mismo código de salida.

```
npm start
  └─ node scripts/dev.cjs
        ├─ spawn: vite --port 5173
        ├─ poll http://localhost:5173 ...
        └─ spawn: electron . (VITE_DEV=1)
```

En `main.js`, cuando `VITE_DEV === '1'`:
- Carga `http://localhost:5173` (hot-reload activo)
- Abre DevTools automáticamente

---

## Vite (`vite.config.js`)

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-renderer',
  },
});
```

Output: `dist-renderer/index.html` + `dist-renderer/assets/index-[hash].js`

---

## electron-builder (`package.json → build`)

### Targets Windows

| Target | Archivo generado |
|---|---|
| `nsis` (instalador) | `SharkReader Setup 1.0.0.exe` |
| `portable` | `SharkReader-Portable-1.0.0.exe` |

Arquitectura: `x64` únicamente.

### Archivos incluidos en el paquete

```json
"files": [
  "main.js",
  "dist-renderer/**",
  "icon_build.ico",
  "node_modules/**",
  "!node_modules/electron/**",
  "!node_modules/electron-builder/**",
  "!node_modules/.cache/**"
]
```

Los paquetes `electron` y `electron-builder` se excluyen del bundle final porque son herramientas de desarrollo, no dependencias runtime.

### Instalador NSIS

| Opción | Valor |
|---|---|
| `oneClick` | `false` (el usuario elige la carpeta) |
| `allowToChangeInstallationDirectory` | `true` |
| `createDesktopShortcut` | `true` |
| `createStartMenuShortcut` | `true` |
| `shortcutName` | `SharkReader` |
| `runAfterFinish` | `true` (lanza la app al terminar la instalación) |

### Portable

Genera un único `.exe` autocontenido sin instalador. Nombre: `SharkReader-Portable-1.0.0.exe`.

---

## Icono

| Archivo | Uso |
|---|---|
| `icon.png` | Icono en modo desarrollo (BrowserWindow) |
| `icon.ico` | Icono general |
| `icon_build.ico` | Icono del instalador NSIS + ventana en producción |

El script `png-to-ico` (devDependency) puede usarse para regenerar el `.ico` a partir del `.png`.

---

## Variables de entorno

| Variable | Cuándo está presente | Significado |
|---|---|---|
| `VITE_DEV=1` | Solo en `npm start` | Indica al Main Process que cargue el servidor Vite en lugar del build |
| `ELECTRON_RUN_AS_NODE` | Inyectada por VS Code | Debe eliminarse antes de lanzar Electron (lo hace `dev.cjs`) |

---

## Estructura del output de build

```
dist/
├── win-unpacked/           # App desempaquetada (para debug)
│   ├── SharkReader.exe
│   ├── resources/
│   │   └── app.asar        # Código empaquetado
│   └── ...dlls y binarios de Chromium/Node
├── SharkReader Setup 1.0.0.exe     # Instalador NSIS
└── SharkReader-Portable-1.0.0.exe  # Portable
```

---

## Requisitos para hacer el build

- Node.js v18 o superior
- npm v9+
- Windows (para generar los targets `.exe`; electron-builder puede generar `.exe` desde Linux/Mac con Wine, pero no es el flujo estándar aquí)
- `npm install` ejecutado previamente

```bash
npm install
npm run build
# Output en dist/
```
