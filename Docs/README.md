# SharkReader — Documentación Oficial

> Versión 1.0.0 · Electron + Vite + React · Windows

SharkReader es un lector de libros digitales de escritorio para Windows. Soporta EPUB y PDF con un conjunto extenso de funciones: IA integrada, colecciones, vocabulario, estadísticas, logros, gamificación y un sistema de addons activables (Workshop).

---

## Índice de documentación

| Archivo | Descripción |
|---|---|
| **[HANDOFF.md](HANDOFF.md)** | **Estado actual del proyecto, bugs resueltos, gotchas críticos — leer primero** |
| [architecture.md](architecture.md) | Stack tecnológico, estructura de archivos y flujo de arranque |
| [features.md](features.md) | Todas las funcionalidades de usuario documentadas |
| [epub-reader-internals.md](epub-reader-internals.md) | Internals del EpubReader: sistema CSS, inyección en iframes, epub.js |
| [data-layer.md](data-layer.md) | Capa de datos: IndexedDB, localStorage y esquemas |
| [addons-workshop.md](addons-workshop.md) | Sistema de addons del Workshop |
| [ai-integration.md](ai-integration.md) | Integración con proveedores de IA |
| [ipc-electron.md](ipc-electron.md) | Canales IPC entre Main Process y Renderer |
| [build-deploy.md](build-deploy.md) | Comandos de desarrollo, build y distribución |

---

## Inicio rápido

```bash
# Instalar dependencias
npm install

# Modo desarrollo (lanza Vite + Electron)
npm start

# Build de producción (instalador NSIS + portable)
npm run build
```

---

## Requisitos del sistema

| Requisito | Mínimo |
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
| PDF | Visualización + zoom (pdfjs-dist) |
| MOBI | Asociación de archivo (apertura vía sistema) |

---

## Licencia

ISC © 2025 SharkReader
