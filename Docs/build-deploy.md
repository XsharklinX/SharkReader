# Build y DistribuciÃ³n

## Comandos

| Comando | DescripciÃ³n |
|---|---|
| `pnpm start` | Modo desarrollo: lanza Vite en `:5173` y Electron apuntando a ese servidor |
| `pnpm build:renderer` | Compila React con Vite â†’ `dist-renderer/` |
| `pnpm build` | Build completo: renderer + instaladores Windows en `dist/` |

---

## Flujo de desarrollo (`pnpm start`)

El script `scripts/dev.cjs` orquesta el arranque:

1. Borra `ELECTRON_RUN_AS_NODE` del entorno (fix necesario cuando se ejecuta desde VS Code, que inyecta esa variable y rompe la detecciÃ³n de Electron).
2. Arranca `npx vite --port 5173` como proceso hijo.
3. Hace polling a `http://localhost:5173` cada 300 ms (hasta 40 intentos = 12 s).
4. Cuando Vite responde, lanza `electron .` con `VITE_DEV=1` en el entorno.
5. Al cerrar Electron, mata el proceso Vite y sale con el mismo cÃ³digo de salida.

```
pnpm start
  â””â”€ node scripts/dev.cjs
        â”œâ”€ spawn: vite --port 5173
        â”œâ”€ poll http://localhost:5173 ...
        â””â”€ spawn: electron . (VITE_DEV=1)
```

En `main.js`, cuando `VITE_DEV === '1'`:
- Carga `http://localhost:5173` (hot-reload activo)
- Abre DevTools automÃ¡ticamente

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

## electron-builder (`package.json â†’ build`)

### Targets Windows

| Target | Archivo generado |
|---|---|
| `nsis` (instalador) | `SharkReader Setup 1.0.0.exe` |
| `portable` | `SharkReader-Portable-1.0.0.exe` |

Arquitectura: `x64` Ãºnicamente.

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

| OpciÃ³n | Valor |
|---|---|
| `oneClick` | `false` (el usuario elige la carpeta) |
| `allowToChangeInstallationDirectory` | `true` |
| `createDesktopShortcut` | `true` |
| `createStartMenuShortcut` | `true` |
| `shortcutName` | `SharkReader` |
| `runAfterFinish` | `true` (lanza la app al terminar la instalaciÃ³n) |

### Portable

Genera un Ãºnico `.exe` autocontenido sin instalador. Nombre: `SharkReader-Portable-1.0.0.exe`.

---

## Icono

| Archivo | Uso |
|---|---|
| `icon.png` | Icono en modo desarrollo (BrowserWindow) |
| `icon.ico` | Icono general |
| `icon_build.ico` | Icono del instalador NSIS + ventana en producciÃ³n |

El script `png-to-ico` (devDependency) puede usarse para regenerar el `.ico` a partir del `.png`.

---

## Variables de entorno

| Variable | CuÃ¡ndo estÃ¡ presente | Significado |
|---|---|---|
| `VITE_DEV=1` | Solo en `pnpm start` | Indica al Main Process que cargue el servidor Vite en lugar del build |
| `ELECTRON_RUN_AS_NODE` | Inyectada por VS Code | Debe eliminarse antes de lanzar Electron (lo hace `dev.cjs`) |

---

## Estructura del output de build

```
dist/
â”œâ”€â”€ win-unpacked/           # App desempaquetada (para debug)
â”‚   â”œâ”€â”€ SharkReader.exe
â”‚   â”œâ”€â”€ resources/
â”‚   â”‚   â””â”€â”€ app.asar        # CÃ³digo empaquetado
â”‚   â””â”€â”€ ...dlls y binarios de Chromium/Node
â”œâ”€â”€ SharkReader Setup 1.0.0.exe     # Instalador NSIS
â””â”€â”€ SharkReader-Portable-1.0.0.exe  # Portable
```

---

## Requisitos para hacer el build

- Node.js v18 o superior
- pnpm v11+
- Windows (para generar los targets `.exe`; electron-builder puede generar `.exe` desde Linux/Mac con Wine, pero no es el flujo estÃ¡ndar aquÃ­)
- `pnpm install` ejecutado previamente

```bash
pnpm install
pnpm build
# Output en dist/
```

