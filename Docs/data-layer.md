# Capa de datos

SharkReader no usa backend ni base de datos externa. Todo el almacenamiento es local, dividido entre IndexedDB (para binarios grandes) y localStorage (para metadatos y configuración).

---

## IndexedDB

**Base de datos:** `SharkReaderDB` · Versión `2`

**Object store:** `files`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string (keyPath) | ID único del libro (`Date.now() + random`) |
| `file` | File / Blob | Archivo original EPUB o PDF |
| `coverBase64` | string \| null | Portada codificada en base64 |
| `originalTitle` | string | Título extraído del EPUB |
| `originalAuthor` | string | Autor extraído del EPUB |
| `dateAdded` | number | Timestamp de importación |

### API (`src/db.js`)

```js
initDB()                                        // Abre/actualiza la BD, retorna IDBDatabase
saveFileToDB(id, file, cover, title, author, date)
deleteFileFromDB(id)
loadFilesFromDB()                               // Retorna todos los registros
fileToBase64(blob)                              // Convierte Blob → base64 data URL
```

### Migración legacy

Al arrancar, `db.js` abre la BD antigua `SharkReaderDB_v4` (versión previa de la app). Si contiene registros y no se ha migrado todavía (`sharkreader_migrated_v2` no existe en localStorage), copia todos los registros al nuevo store y marca la migración como completada.

---

## localStorage

Todas las claves usan el prefijo `sharkreader_`.

### Metadatos de biblioteca

**Clave:** `sharkreader_meta`  
**Tipo:** `{ [key: string]: BookMeta }`

La clave del objeto es `"${originalTitle}|${originalAuthor}"`.

Campos de `BookMeta`:

| Campo | Tipo | Descripción |
|---|---|---|
| `customTitle` | string | Título editado por el usuario |
| `customAuthor` | string | Autor editado |
| `customCover` | string | Portada personalizada (base64 o URL) |
| `description` | string | Sinopsis |
| `publisher` | string | Editorial |
| `tags` | string | Tags separados por coma |
| `series` | string | Nombre de la serie |
| `seriesIndex` | number | Número dentro de la serie |
| `isFav` | boolean | ¿Es favorito? |
| `rating` | number | Puntuación 0–5 |
| `progress` | number | Porcentaje de progreso 0–100 |
| `lastLocation` | string | CFI de epub.js de la última posición |
| `lastReadDate` | number | Timestamp de última lectura |
| `bookmarks` | `Bookmark[]` | Lista de marcadores |
| `notes` | string | Notas libres del lector |
| `isFinished` | boolean | ¿Terminado? |
| `dateStarted` | number \| null | Timestamp de inicio |
| `dateFinished` | number \| null | Timestamp de finalización |
| `readingMinutes` | number | Minutos leídos acumulados |
| `category` | string \| null | Categoría personalizada |

### Estructura de un marcador

```ts
interface Bookmark {
  cfi: string;     // CFI de epub.js
  note: string;    // Texto del marcador
  date: string;    // Fecha formateada (toLocaleDateString)
}
```

### Highlights (subrayados)

**Clave:** `sharkreader_highlights_${bookId}`  
**Tipo:** `Highlight[]`

```ts
interface Highlight {
  cfi: string;
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'red';
  note?: string;
  date: number;
}
```

### Vocabulario

**Clave:** `sharkreader_vocab`  
**Tipo:** `VocabEntry[]`

```ts
interface VocabEntry {
  word: string;
  definition: string;
  context: string;
  bookId: string;
  date: number;
}
```

### Reading Journal

**Clave:** `sharkreader_journal`  
**Tipo:** `JournalEntry[]`

```ts
interface JournalEntry {
  date: number;
  bookId: string;
  bookName: string;
  minutes: number;
  progressStart: number;
  progressEnd: number;
}
```

### Estadísticas globales

**Clave:** `sharkreader_stats`

| Campo | Tipo | Descripción |
|---|---|---|
| `timeRead` | number | Minutos totales leídos |
| `pagesTurned` | number | Páginas pasadas totales |
| `streak` | number | Racha actual (días) |
| `maxStreak` | number | Racha máxima histórica |
| `lastActiveDate` | string | Fecha ISO del último día activo |
| `hourlyLog` | `{[hour: number]: number}` | Actividad por hora del día |
| `themesUsed` | string[] | Temas usados (para logro "Diseñador") |
| `quoteExported` | boolean | Para logro "Artista de Citas" |

### Logros

**Clave:** `sharkreader_achievements`  
**Tipo:** `{ [achievementId: string]: boolean }`

### Addons Workshop

**Clave:** `sharkreader_addons`  
**Tipo:** `{ [addonId: string]: boolean }`

### Configuración de usuario

| Clave | Tipo | Descripción |
|---|---|---|
| `sharkreader_theme` | `'light' \| 'dark' \| 'sepia'` | Tema visual |
| `sharkreader_lang` | `'es' \| 'en'` | Idioma |
| `sharkreader_accent` | string | Color de acento (hex) |
| `sharkreader_font_size` | number | Tamaño base de fuente en el lector |
| `sharkreader_font_family` | string | Familia tipográfica |
| `page_transition` | string | Animación de página (`none/fade/slide/flip`) |
| `sharkreader_yearly_goal` | number | Meta de libros por año |
| `sharkreader_migrated_v2` | `'true'` | Flag de migración legacy |

### Sincronización local

**Archivo:** `sharkreader_sync.json` en la carpeta configurada por el usuario.  
**Contenido:** JSON con todos los metadatos (`sharkreader_meta`) + stats + journal.  
Se escribe y lee vía IPC (ver [ipc-electron.md](ipc-electron.md)).

---

## Persistencia del carrito de sesión (Vender — si aplica)

Para módulos con sesión temporal, se usa `sessionStorage` con la clave `cart-${businessId}`. Se limpia al completar la operación.

---

## Ciclo de vida de los datos

```
Usuario importa libro
  │
  ├─ Blob guardado en IndexedDB (files store)
  ├─ Portada extraída y guardada como base64 en IDB
  └─ Metadatos iniciales cargados al estado React (books[])
        │
        └─ Al cerrar/modificar
              └─ Metadatos sincronizados a localStorage (sharkreader_meta)
```

El estado en memoria (`books[]`) y localStorage se mantienen en sync mediante `useEffect` en `App.jsx` que observa cambios en el array de libros.
