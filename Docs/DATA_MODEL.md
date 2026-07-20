# Modelo de datos de SharkReader

Este documento describe los esquemas de datos persistidos (libros, backup
portable) y su historial de versiones. Es la referencia para cualquier
cambio de esquema — antes de añadir/renombrar un campo, mira si ya existe
un equivalente y añade una migración (`src/backupMigrations.js`) si el
cambio afecta al formato del backup.

## 1. Registro de libro (`BookRecord`)

Fuente de verdad: `src/bookModel.js` (`toStoredBookRecord`, `hydrateStoredBook`).
Es la forma persistida en IndexedDB (`books` store) y la forma que viaja
dentro de un backup (`backup.books[]`).

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | Identificador estable del libro. |
| `sourcePath` | string\|null | Ruta original en disco (folder import / asociación de archivo). |
| `type` | `'epub' \| 'pdf'` | Formato del libro. |
| `originalTitle` / `originalAuthor` | string | Metadata extraída del archivo. |
| `customTitle` / `customAuthor` | string | Overrides manuales del usuario (vacío = usa el original). |
| `coverBase64` | string\|null | Portada extraída del archivo, ya redimensionada a miniatura (ver `coverResize.js`). |
| `customCover` | string\|null | Portada elegida manualmente por el usuario. |
| `description`, `publisher`, `tags`, `series`, `seriesIndex` | — | Metadata de catálogo. `tags` es un string separado por comas, no un array. |
| `progress`, `lastLocation`, `lastReadDate`, `readingMinutes`, `isFinished`, `dateStarted`, `dateFinished` | — | Progreso de lectura. |
| `bookmarks` | `Bookmark[]` | Marcadores, notas y subrayados (ver abajo). |
| `isFav`, `rating`, `category`, `notes`, `pdfScale`, `readerPreferences` | — | Preferencias por libro. |
| `anniversaryMilestonesSeen` | `number[]` | Días de aniversario ya notificados (evita repetir el aviso). |
| `dateAdded` | number (epoch ms) | Fecha de importación — al fusionar dos copias del mismo libro, se toma el **mínimo** de las dos (dedup no debe "reiniciar" la antigüedad). |
| `updatedAt` | number | Máximo de todos los timestamps de abajo — usado para decidir qué copia es "más nueva" en dedup de biblioteca. |
| `progressUpdatedAt` | number | Última vez que cambió progreso/posición/tiempo leído. |
| `metadataUpdatedAt` | number | Última vez que cambió título/autor/portada/tags/rating/etc. |
| `annotationsUpdatedAt` | number | Última vez que cambiaron los `bookmarks`. |

### `Bookmark` (marcador / nota / subrayado)

| Campo | Tipo | Descripción |
|---|---|---|
| `cfi` | string | Posición (EPUB CFI o número de página serializado para PDF). |
| `note` | string | Texto de la nota, o `[Subrayado] "texto..."` para subrayados (formato heredado, ver `normalizeAnnotationKind` en `annotationExport.js`). |
| `date` | string | Fecha legible (no epoch — heredado). |
| `color` | string\|null | Color del subrayado (`yellow`/`green`/`blue`/`pink`) — el **significado** de cada color es editable por el usuario vía `highlightLabels.js`, pero el color en sí es fijo. |
| `kind` | `'highlight' \| 'note' \| null` | `null`/ausente = marcador simple. |

## 2. Backup portable (`PortableBackup`)

Fuente de verdad: `src/backupMerge.js` (`buildPortableBackup`), validado y
saneado al leer por `src/backupValidation.js` (`validateBackupData`) —
**nunca** confíes en un backup importado sin pasar por esa función primero,
sea de un ZIP, un `.json` suelto, o el archivo de sync.

```
{
  schemaVersion: number,        // ver "Historial de versiones" abajo
  app: 'SharkReader',
  exportedAt: string (ISO8601),
  books: BookRecord[],
  deletedBooks: { [bookId]: timestamp },   // tombstones de borrado
  categories: string[],
  collections: Collection[],
  stats: object,                // racha, minutos leídos, etc. (ver stats.js)
  user: { name, avatar, joinedAt },
  workshop: { addons, addonConfig, externalSources },
  achievements: { [achievementId]: { unlockedAt: number } },   // desde v4
  settingsUpdatedAt: number,    // desde v4 — última vez que cambió workshop/categories/collections
}
```

### Dónde vive cada pieza en un ZIP de backup (`exportZipBackup`)

| Archivo dentro del ZIP | Contenido |
|---|---|
| `sharkreader-backup.json` | El `PortableBackup` completo — es la fuente de verdad al importar. |
| `books-metadata.json` | Solo `backup.books` (para inspección humana / scripts). |
| `progress-and-stats.json` | Progreso resumido por libro + `stats`. |
| `settings-workshop.json` | `categories`, `collections`, `workshop`, `externalSources`. |
| `achievements.json` | `backup.achievements` — desde v4. |
| `diagnostics.json` | Log de diagnóstico interno (no es dato de usuario, solo depuración). |
| `checksums.json` | SHA-256 de `sharkreader-backup.json`, para detectar corrupción del ZIP al importar. |
| `books/*` | Archivos EPUB/PDF originales — **solo si el usuario eligió "backup completo"**. |
| `README.txt` | Instrucciones de restauración legibles por humanos. |

### Merge de dos backups (sync entre dispositivos)

`mergeBackupData(local, incoming)` fusiona **por campo**, no por objeto
completo, para que dos dispositivos que editaron cosas distintas no se
pisen entre sí:

- **Libros**: se identifican por `getBookDedupKey`/`getBookTitleDedupKey`
  (mismo archivo o mismo título+autor), y luego se fusiona *cada grupo de
  campos* por separado comparando su propio timestamp — `progressUpdatedAt`
  para progreso, `metadataUpdatedAt` para metadata, `annotationsUpdatedAt`
  para marcadores (con unión de bookmarks si ambos cambiaron a la vez).
- **Ajustes/Workshop**: gana el lado con `settingsUpdatedAt` más reciente
  (todo el bloque junto — no tiene sentido fusionar campo a campo un blob
  de configuración de addons). `categories`/`collections` sí se fusionan
  por unión (añadir en un dispositivo no borra lo del otro).
- **Logros**: unión — un logro desbloqueado en cualquiera de los dos lados
  queda desbloqueado, conservando el `unlockedAt` **más antiguo** de los
  dos (esa es la fecha real en la que se ganó, no la fecha del último sync).
- **Stats**: los contadores acumulativos (tiempo leído, rachas, etc.) toman
  el máximo de los dos lados.

## 3. Historial de versiones (`schemaVersion`)

Las migraciones explícitas viven en `src/backupMigrations.js`
(`migrateBackupToLatest`) — se aplican en cadena antes de validar/normalizar
un backup importado, así que un backup de hace años sigue restaurando sin
requerir lógica especial en ningún otro sitio del código.

| Versión | Qué cambió |
|---|---|
| 1 | Esquema original: libros + categorías + colecciones + stats + user + workshop. |
| 2 | Se añaden tombstones de borrado (`deletedBooks`) y `annotationsUpdatedAt` por libro. |
| 3 | Se consolida `updatedAt` por libro (máximo de los tres timestamps de campo). |
| 4 | Se añaden `achievements` (historial de logros con fecha de desbloqueo) y `settingsUpdatedAt` (para fusionar Workshop/ajustes por fecha en vez de "el que llega después gana"). |

Al subir la versión: añade una función `migrateVN_toVN+1` en
`backupMigrations.js`, regístrala en `MIGRATIONS`, y añade una fila a esta
tabla — son parte del mismo cambio, no un paso aparte.
