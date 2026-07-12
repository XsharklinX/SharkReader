# SharkReader 🦈

<div align="center">

[![Última versión](https://img.shields.io/github/v/release/XsharklinX/SharkReader?color=38bdf8&label=versi%C3%B3n&style=flat-square)](https://github.com/XsharklinX/SharkReader/releases/latest)
[![Descargas totales](https://img.shields.io/github/downloads/XsharklinX/SharkReader/total?color=22c55e&label=descargas&style=flat-square)](https://github.com/XsharklinX/SharkReader/releases)
[![Licencia ISC](https://img.shields.io/github/license/XsharklinX/SharkReader?color=a78bfa&label=licencia&style=flat-square)](LICENSE)
[![Plataforma](https://img.shields.io/badge/Windows-10%20%2F%2011-0078d4?style=flat-square&logo=windows)](https://github.com/XsharklinX/SharkReader/releases/latest)
[![Tests](https://img.shields.io/badge/tests-95%2F95-22c55e?style=flat-square)](#desarrollo)

**Lector de EPUB y PDF para Windows. Local-first, gratuito, sin cuenta, sin nube.**

[⬇ Descargar](#instalación) · [Ver características](#qué-hace) · [Captura](#capturas) · [Desarrolladores](#para-desarrolladores) · [Roadmap](#roadmap)

</div>

---

<div align="center">
  <img src="docs/assets/screen-library.png" alt="Biblioteca de SharkReader" width="800" style="border-radius:12px">
</div>

---

## Por qué existe esto

Casi todos los lectores de escritorio tienen algún problema grave: son de pago, requieren cuenta, mandan tus datos a servidores externos, o simplemente no están bien hechos. SharkReader surgió como respuesta a eso.

Es una app que funciona sin internet, guarda todo en tu dispositivo, y está pensada para quien lee en serio: subrayados, notas, analíticas, metas, logros. Sin suscripciones ni trucos.

---

## Qué hace

### 📖 Lector EPUB

- Subrayados en 4 colores con notas al margen, visibles directamente en el texto
- Dark mode universal: neutraliza EPUBs con fondos hardcodeados, sin importar el CSS del libro
- Tipografía completamente personalizable por libro: fuente, tamaño, interlineado, márgenes, justificación, sangría, espacio entre letras, separación silábica y espaciado entre párrafos
- TOC flotante con búsqueda integrada en todos los niveles del índice
- Presets tipográficos: Equilibrado, Enfoque, Compacto, Accesible — con un clic
- Temas de lectura personalizados: color de texto + fondo, guardables con nombre y reutilizables entre libros
- Modo foco completo: oculta barra, progreso y zonas de navegación. Solo el texto
- Modo dislexia: inyecta OpenDyslexic dentro del iframe del EPUB con ajustes de espaciado automáticos
- Doble página, scroll continuo o paginado, búsqueda interna con navegación ←→
- Progreso por capítulo (`pág. X/Y` de la sección) e historial de posiciones (Alt+← deshace saltos de TOC/búsqueda)
- Panel de anotaciones filtrable por tipo (subrayado / nota / marcador) y por color, con etiquetas de subrayado personalizables
- Imagen de cita: selecciona una frase y genera un PNG descargable con la portada y paleta del tema
- Export a Obsidian: `.md` con frontmatter YAML, anotaciones agrupadas por capítulo y notas del libro incluidas
- Auto-bookmark al cerrar cada tab; diccionario en línea; vocabulario exportable

### 🔊 Lectura en voz alta (TTS)

- **Motor neuronal** (Microsoft Edge Read Aloud, gratis, sin API key): 13 voces en español e inglés con calidad casi humana — Elvira, Álvaro, Dalia, Jorge, Ramona, Emilio, Elena, Tomás, Salomé, Gonzalo y más
- **Motor de sistema** como alternativa offline (voces instaladas en Windows)
- Lee exactamente lo que está en pantalla — nunca contenido de otra página o capítulo
- Sombrea en vivo el párrafo que va narrando y hace auto-scroll suave en modo continuo
- Avanza de página sola al terminar lo visible, respetando el corte exacto cuando un párrafo queda partido entre dos páginas
- Toca cualquier párrafo mientras escuchas para saltar la lectura ahí mismo
- Trocea el texto en frases (no en párrafos completos): cambiar de voz o velocidad retoma cerca de donde ibas, no desde el principio

### 📄 Lector PDF

- Highlights multicolor con coordenadas porcentuales (sobreviven cualquier zoom)
- TOC/outline del PDF con búsqueda por título o página, resaltado de página activa
- Búsqueda de texto con hasta 80 resultados por consulta, navegación anterior/siguiente
- Dark mode: `invert + hue-rotate` en el canvas, sin afectar los overlays de subrayado
- Zoom con `Ctrl +`, `Ctrl -`, `Ctrl 0` y rueda del ratón; persiste entre sesiones
- Panel de anotaciones filtrable por tipo y color; export → Markdown con frontmatter YAML

### 📚 Biblioteca

- Importación individual, por carpeta o desde fuentes OPDS/Calibre externas
- Fetch de portada y metadata desde OpenLibrary (sin registro, sin clave de API)
- Multi-select con acciones en masa: favorito, terminado, categoría, colección, autor, serie (con índices automáticos), eliminar
- Edición rápida inline: nombre, autor, tags y rating sin abrir ningún modal
- Paleta de comandos (Ctrl+K / Cmd+K): navega, cambia de tema, abre ajustes o busca cualquier libro por título/autor sin tocar el ratón
- Vista por serie con detección de huecos, badge "Siguiente #N" y "✓ Completa"
- Colecciones manuales con emoji, rename inline, reorder y portadas dinámicas
- Estanterías automáticas: "Pausados +6 meses" y "Casi terminados ≥80%"
- Filtros combinados por tag y autor (multi-select) con pills activas y × para limpiar
- Búsqueda global con índice de contenido (busca dentro del texto del EPUB/PDF)
- Virtualización para bibliotecas grandes; renders estabilizados para el lector

### 🏆 Gamificación y estadísticas

- 60 logros clasificados en 4 rarezas: común, raro, épico y legendario
- Sistema de XP con 7 niveles: Aprendiz → Curioso → Lector → Devorador → Bibliófilo → Sabio → Leyenda
- Rachas diarias con racha máxima histórica y notificación de pérdida
- Analíticas: heatmap anual, gráfica días/semanas/meses, Top 5 libros, log por hora
- Metas diaria, semanal y mensual con barra de progreso en tiempo real
- Plan de lectura con fecha objetivo y cálculo automático de ritmo necesario
- Resumen Anual estilo Wrapped: 7 slides animados con tus estadísticas del año
- Diario de lectura: log de sesiones con libro, tiempo y fecha, exportable a Markdown
- **Retos de lectura**: racha de N días, minutos en una semana o libros en un mes — con barra de progreso, fecha límite y fanfarria al completar
- **Resumen semanal**: notificación nativa una vez por semana con minutos leídos, días activos, libros terminados y racha

### 🔧 Workshop y addons

18 addons modulares, cada uno con su configuración propia:

| Addon | Qué hace |
|---|---|
| 🔊 Sonido de feedback | Sonidos sintetizados al lograr hitos, pasar página, subir de nivel |
| 🦈 Sharky | Mascota pixelart con cosméticos desbloqueables por XP |
| ⭐ Nivel XP | Sistema de XP por lectura con nombres de nivel |
| 🎯 Modo foco | Oculta la UI durante la lectura |
| 📰 Modo dislexia | Fuente OpenDyslexic dentro del EPUB |
| 🍅 Pomodoro | Timer de sesión en el lector |
| 📓 Diario de lectura | Log de sesiones exportable |
| 🎲 Ruleta de libro | Elige un libro al azar con filtros por tag/favoritos |
| 📂 Carpeta vigilada | Importación automática de una carpeta |
| 🔖 Auto-bookmark | Guarda posición al cerrar el tab |
| 🔔 Recordatorios | Notificación nativa si no lees hoy |
| 📑 TOC inteligente | TOC flotante con búsqueda |
| ✨ Portadas dinámicas | Efectos por estado: glow favorito, pulse leyendo |
| 📺 Vista Netflix | Grid de portadas grande, estilo visual alternativo |
| 🌐 Fuentes externas | Catálogos OPDS / Calibre |
| 💾 Auto-backup | Copia de seguridad periódica automática |
| 📖 Modo lectura | Indicadores de contexto visual |
| 🔍 Búsqueda de contenido | Índice de texto completo del libro |

**Presets de Workshop:** tres configuraciones de un clic para empezar sin perderse entre 18 opciones:
- 🎯 **Lector enfocado** — Focus mode, auto-bookmark, TOC inteligente, sonido de feedback
- 📚 **Coleccionista** — Portadas dinámicas, vista Netflix, carpeta vigilada, diario
- 🏆 **Gamer** — Sistema XP, Sharky, sonido, ruleta, portadas dinámicas

### 🦈 Sharky

Mascota de pixel art que vive en una esquina de la pantalla. Tiene sprites emocionales (feliz, curioso, dormido, sorprendido…), emotes animados y cosméticos (corona, gorra, gafas, bufanda) que se desbloquean por nivel de XP.

Reacciona a eventos reales: abrir un libro, alcanzar hitos de progreso (25%, 50%, 75%, 100%), terminar un libro, logros, rachas, pérdida de racha y aniversarios de lectura. Configurable: puedes ajustar su presencia (Normal / Ligera / Solo hitos) o silenciarlo completamente.

### 🔒 Privacidad y datos

- **Local-first**: todo se guarda en IndexedDB en tu dispositivo. Cero servidores propios
- CSP estricto en producción; `webSecurity` habilitado; scripts embebidos en EPUB desactivados
- Export/import de todos tus datos en un JSON portátil con merge inteligente
- **Backup ZIP completo opcional**: incluye los archivos EPUB/PDF además de metadata y progreso, para restaurar el 100% de tu biblioteca en otro PC
- Sync automático a carpeta local (OneDrive, Dropbox, cualquier carpeta compartida), con flush al cerrar la app para no perder los últimos cambios
- System tray de Windows: "Continuar leyendo [último libro]" sin abrir la ventana principal
- Auto-updater vía GitHub Releases (verificable y reversible)

---

## Capturas

| Biblioteca | Analíticas |
|---|---|
| ![Biblioteca](docs/assets/screen-library.png) | ![Analíticas](docs/assets/screen-analytics.png) |

![Logros](docs/assets/screen-achievements.png)

---

## Instalación

### Opción A: Instalador (recomendado)

1. Ve a la página de [Releases](https://github.com/XsharklinX/SharkReader/releases/latest)
2. Descarga el archivo `SharkReader-Setup-x.x.x.exe`
3. Ejecútalo e instala normalmente
4. Abre SharkReader desde el menú de inicio o el acceso directo del escritorio

### Opción B: Versión portable

1. Descarga `SharkReader-Portable-x.x.x.exe` desde [Releases](https://github.com/XsharklinX/SharkReader/releases/latest)
2. Ejecútalo directamente desde cualquier carpeta o unidad USB

### Nota sobre Windows SmartScreen

Windows puede mostrar una advertencia azul porque la app no tiene certificado de firma de código (un trámite que cuesta ~200€/año). Si descargaste desde los Releases oficiales de este repositorio, la app es segura. Para instalarla: **Más información → Ejecutar de todas formas**.

El código fuente está disponible aquí para quien quiera verificarlo.

---

## Formatos soportados

| Formato | Biblioteca | Lector |
|---|---|---|
| EPUB 2 / EPUB 3 | ✅ | ✅ |
| PDF | ✅ | ✅ |

---

## Para desarrolladores

### Requisitos

- Windows 10 o superior
- Node.js 20+
- pnpm 8+

Este proyecto usa `pnpm`. No mezcles `npm` y `pnpm` en el mismo checkout.

### Instalar dependencias

```powershell
pnpm install
```

### Desarrollo (Electron + HMR)

```powershell
pnpm start
```

o bien:

```powershell
pnpm dev
```

El renderer corre en `http://127.0.0.1:5173` con Hot Module Replacement.

### Compilar solo el renderer

```powershell
pnpm build:renderer
```

### Compilar el instalador y la versión portable

```powershell
pnpm build
```

Los archivos generados quedan en `dist/`.

### Tests

```powershell
pnpm test
```

95 tests unitarios cubriendo la lógica pura de:
- `src/bookModel.test.js` — modelo de libro, hidratación, deduplicación (35 tests)
- `src/backupMerge.test.js` — merge de backups, bookmarks, minutesByDay (15 tests)
- `src/readingProgress.test.js` — lógica de rachas, XP y niveles (20 tests)
- `src/challenges.test.js` — retos de lectura y resumen semanal (16 tests)
- `src/ttsChunks.test.js` — divisor de texto en frases para el TTS (9 tests)

---

## Estructura del proyecto

```
SharkReader/
├── main.js                    # Proceso principal de Electron
├── preload.js                 # Puente IPC seguro (contextBridge)
├── src/
│   ├── App.jsx                # Shell principal
│   ├── EpubReader.jsx         # Lector EPUB (epub.js) — incluye el TTS completo
│   ├── PdfReader.jsx          # Lector PDF (pdfjs-dist)
│   ├── EpubReaderSettings.jsx # Tipografía, presets y temas de lectura custom
│   ├── AnalyticsView.jsx      # Estadísticas, logros y retos de lectura
│   ├── WorkshopPanel.jsx      # Panel de addons con presets
│   ├── SettingsPanel.jsx      # Configuración, backup, diagnóstico
│   ├── CommandPalette.jsx     # Paleta de comandos Ctrl+K / Cmd+K
│   ├── Sidebar.jsx            # Panel lateral de la biblioteca
│   ├── LibraryView.jsx        # Grid / lista / series de la biblioteca
│   ├── BookCard.jsx           # Tarjeta de libro
│   ├── QuickEditCard.jsx      # Edición rápida inline
│   ├── SharkyContext.jsx      # Estado y lógica de la mascota
│   ├── SharkyWidget.jsx       # JSX de Sharky
│   ├── YearWrapped.jsx        # Resumen anual (Wrapped)
│   ├── TipToast.jsx           # Toast "¿Sabías que?" en la biblioteca
│   ├── sounds.js              # Sonidos sintetizados vía Web Audio API
│   ├── db.js                  # IndexedDB v6 (5 stores)
│   ├── bookModel.js           # Modelo de libro, hidratación y deduplicación
│   ├── backupMerge.js         # Merge inteligente de backups
│   ├── achievements.js        # Definición de los 60 logros
│   ├── challenges.js          # Lógica pura de retos de lectura (testeable)
│   ├── highlightLabels.js     # Etiquetas de subrayado personalizables
│   ├── ttsChunks.js           # Divisor de texto en frases para el TTS (testeable)
│   ├── workshopModules.js     # Registro de los 18 addons
│   ├── readingProgress.js     # Lógica pura de rachas y XP (testeable)
│   ├── translations.js        # i18n ES/EN
│   └── hooks/
│       ├── useLibrary.js               # Filtros, búsqueda y virtualización
│       ├── useBookImport.js            # Importación individual y por carpeta
│       ├── useBookActions.js           # CRUD de libros (favorito, borrar, editar…)
│       ├── useReaderOrchestration.js   # Tabs abiertas, panel dividido, apertura/cierre de libros
│       ├── useReadingSession.js        # Timer, rachas, logros en sesión
│       ├── useStats.js                 # Estado y persistencia de estadísticas
│       └── useUI.js                    # Estado de modales, sidebar y toasts
├── styles/
│   └── main.css               # Estilos globales, temas dark/light/sepia
├── public/
│   └── preloader.js           # Script de precarga (cumple CSP)
├── docs/
│   ├── index.html             # Landing page (GitHub Pages)
│   ├── assets/                # Capturas de pantalla
│   └── *.md                   # Documentación técnica
└── package.json
```

### Persistencia de datos

SharkReader usa IndexedDB v6 con 5 stores:

| Store | Contenido |
|---|---|
| `books` | Metadata y progreso de cada libro |
| `files` | Archivos EPUB/PDF importados |
| `settings` | Configuración del usuario, addons y perfil |
| `cache` | Índice de contenido de búsqueda |
| `legacy_appData` | Compatibilidad con versiones anteriores |

Cada store se puede exportar/importar individualmente. El merge de backups resuelve conflictos por `updatedAt`, `progressUpdatedAt` y `metadataUpdatedAt` por separado.

---

## Roadmap

| Versión | Criterio de salida | Estado |
|---|---|---|
| **v3.7** | Lector premium: temas custom, historial de posiciones, imagen de cita, TTS reconstruido con motor neuronal | ✅ |
| **v3.8** | Conocimiento activo: retos de lectura, resumen semanal, etiquetas de subrayado personalizables | ✅ |
| **v3.9** | Datos y confianza: ZIP completo con archivos, sync automático al cerrar, paleta de comandos, system tray | ✅ |
| **v4.0** | Publicable: accesibilidad AA, descomposición de `App.jsx`, virtualización de búsqueda, onboarding con logo real | En curso |

La comparación de libros lado a lado y las colecciones inteligentes por reglas quedaron fuera de v3.8 por alcance y están en el radar para el siguiente roadmap. Detalles de implementación en [`docs/roadmap-hardening.md`](docs/roadmap-hardening.md).

---

## Contribuir

Si quieres reportar un bug o sugerir una funcionalidad, abre un [issue](https://github.com/XsharklinX/SharkReader/issues). Para contribuir con código:

1. Haz un fork del repositorio
2. Crea una rama para tu cambio: `git checkout -b mi-mejora`
3. Instala dependencias: `pnpm install`
4. Desarrolla con `pnpm dev`
5. Verifica que compila: `pnpm build:renderer`
6. Pasa los tests: `pnpm test`
7. Abre un pull request

---

## Disclaimer

SharkReader no distribuye libros. El soporte de fuentes externas (OPDS, Calibre) está pensado para bibliotecas personales, fuentes de dominio público y contenido al que el usuario tiene acceso legal.

---

## Licencia

[ISC](LICENSE) · Desarrollado por **David Bonilla**
