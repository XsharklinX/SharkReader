# SharkReader â€” DocumentaciÃ³n Oficial

> VersiÃ³n 1.0.0 Â· Electron + Vite + React Â· Windows

SharkReader es un lector de libros digitales de escritorio para Windows. Soporta EPUB y PDF con un conjunto extenso de funciones: IA integrada, colecciones, vocabulario, estadÃ­sticas, logros, gamificaciÃ³n y un sistema de addons activables (Workshop).

---

## Ãndice de documentaciÃ³n

| Archivo | DescripciÃ³n |
|---|---|
| **[HANDOFF.md](HANDOFF.md)** | **Estado actual del proyecto, bugs resueltos, gotchas crÃ­ticos â€” leer primero** |
| [architecture.md](architecture.md) | Stack tecnolÃ³gico, estructura de archivos y flujo de arranque |
| [features.md](features.md) | Todas las funcionalidades de usuario documentadas |
| [epub-reader-internals.md](epub-reader-internals.md) | Internals del EpubReader: sistema CSS, inyecciÃ³n en iframes, epub.js |
| [data-layer.md](data-layer.md) | Capa de datos: IndexedDB, localStorage y esquemas |
| [addons-workshop.md](addons-workshop.md) | Sistema de addons del Workshop |
| [ai-integration.md](ai-integration.md) | IntegraciÃ³n con proveedores de IA |
| [ipc-electron.md](ipc-electron.md) | Canales IPC entre Main Process y Renderer |
| [build-deploy.md](build-deploy.md) | Comandos de desarrollo, build y distribuciÃ³n |

---

## Inicio rÃ¡pido

```bash
# Instalar dependencias
pnpm install

# Modo desarrollo (lanza Vite + Electron)
pnpm start

# Build de producciÃ³n (instalador NSIS + portable)
pnpm build
```

---

## Requisitos del sistema

| Requisito | MÃ­nimo |
|---|---|
| Sistema operativo | Windows 10 64-bit |
| RAM | 512 MB |
| Disco | 150 MB libres |
| Node.js (desarrollo) | v18+ |

---

## Formatos soportados

| Formato | Soporte |
|---|---|
| EPUB 2 / EPUB 3 | Completo (epub.js) |
| PDF | VisualizaciÃ³n + zoom (pdfjs-dist) |
| MOBI | AsociaciÃ³n de archivo (apertura vÃ­a sistema) |

---

## Licencia

ISC Â© 2025 SharkReader

