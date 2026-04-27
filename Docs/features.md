# Funcionalidades

## 1. Biblioteca

La pantalla principal de la aplicación. Muestra todos los libros importados.

### Vistas disponibles

| Vista | Descripción |
|---|---|
| Grid (por defecto) | Cuadrícula de portadas medianas |
| Netflix (addon) | Portadas grandes con hover informativo |
| Lista | Tabla compacta con metadatos |

### Importación de libros

- **Drag & drop** de archivos `.epub` / `.pdf` directamente sobre la ventana.
- **Botón "Añadir libro"** — selector de archivo individual.
- **Botón "Añadir carpeta"** — importa todos los EPUB/PDF de una carpeta.
- **Apertura directa** — al hacer doble clic en un `.epub` o `.pdf` en el explorador de Windows (requiere activar las asociaciones de archivo en Ajustes → Avanzado).

Al importar un EPUB, la app extrae automáticamente portada, título, autor, descripción, editorial y tags usando `epub.js`.

### Filtros

| Filtro | Criterio |
|---|---|
| Todos | Todos los libros |
| Favoritos | `isFav === true` |
| Leyendo | `lastReadDate > 0 && !isFinished` |
| Sin empezar | `!lastReadDate && !isFinished` |
| Terminados | `isFinished === true` |
| Lista de deseos | `isWishlist === true` |
| Por categoría | Coincide con `book.category` |

### Ordenación

- Última lectura
- Añadidos recientemente
- Nombre (A-Z)
- Progreso
- Puntuación (rating)

### Edición de metadatos

El menú contextual de cada libro (clic derecho) da acceso a:
- Cambiar título y autor
- Cambiar portada (URL o base64)
- Añadir sinopsis, editorial, tags
- Asignar serie y orden en la serie
- Asignar categoría personalizada
- Marcar como favorito / terminado
- Puntuar del 1 al 5

---

## 2. Lector EPUB (`EpubReader.jsx`)

### Modos de lectura

| Modo | Descripción |
|---|---|
| Paginado | Navegación página a página con animaciones |
| Continuo | Scroll vertical sin interrupciones |

### Layout

- Página única
- Doble página (dos columnas simultáneas)

### Animaciones de página

Activables en Ajustes → Transición de página (solo en modo paginado):

| Animación | Efecto |
|---|---|
| Ninguna | Cambio instantáneo |
| Fade | Fundido de opacidad |
| Slide | Deslizamiento horizontal sutil (±8%) |
| Flip | Rotación 3D tipo libro (perspective + rotateY ±18°) |

La animación se aplica sobre el contenedor `div` del visor; el iframe de epub.js cambia el contenido de forma asíncrona durante el intervalo de salida (130 ms).

### Tipografía

- Tamaño de fuente ajustable con botones +/−
- Fuente del sistema o **OpenDyslexic** (addon)
- Modo cálido (warm tint) para lectura nocturna
- Brillo ajustable

### Navegación

- Botones prev/next
- Tabla de contenidos (TOC) lateral
- **TOC flotante** (addon): panel flotante con indicador de posición actual
- Atajos de teclado: ← / → para cambiar página

### Marcadores y notas

- Añadir marcador en la posición actual (con nota opcional)
- Lista de marcadores con acceso directo a la posición
- Marcador automático (addon): guarda la última posición al cerrar

### Subrayados (highlights)

- Seleccionar texto en el lector y elegir color: amarillo, verde, azul, rojo
- Exportar cita como imagen PNG (canvas + estilos)
- Panel de highlights con acceso a cada posición

### X-Ray (addon)

Panel lateral con tres secciones configurables:
- **Personajes**: nombres de personajes del libro
- **Lugares**: ubicaciones mencionadas
- **Términos**: conceptos o términos clave

El usuario puede añadir entradas manualmente o seleccionando texto en el lector.

### Vocabulario

Al seleccionar una palabra en el lector, se puede guardar en el vocabulario con:
- La palabra
- Una definición personal
- El contexto (frase donde aparece)

El vocabulario es global a todos los libros y accesible desde el menú lateral.

### Modo Focus (addon)

La barra superior se oculta tras 2.5 s de inactividad. Mover el ratón al borde superior la restaura con una transición suave.

### Asistente IA (panel lateral)

Ver sección [ai-integration.md](ai-integration.md).

### Auto-scroll

Modo scroll automático con velocidad ajustable (píxeles/intervalo). Activable con un botón en la barra del lector.

---

## 3. Lector PDF (`PdfReader.jsx`)

- Renderizado página a página con `pdfjs-dist`
- Zoom con botones +/−
- Navegación numérica (ir a página X)
- Modo una página / doble página
- Modo oscuro / claro independiente del tema global

---

## 4. Sistema de pestañas

La aplicación soporta múltiples libros abiertos en paralelo mediante pestañas:
- Cada pestaña mantiene su propio estado de lectura independiente
- La pestaña activa se resalta visualmente
- Se pueden cerrar pestañas individualmente o todas a la vez
- El título de la pestaña es el nombre del libro

---

## 5. Asistente IA

Ver [ai-integration.md](ai-integration.md).

---

## 6. Vocabulario

Panel accesible desde el menú lateral. Muestra todas las palabras guardadas con:
- Palabra y definición
- Contexto de donde fue capturada
- Búsqueda filtrada
- Exportación a texto plano

---

## 7. Reading Journal

Registro automático de sesiones de lectura. Cada sesión guarda:
- Fecha y hora de inicio/fin
- Libro leído
- Minutos de sesión
- Progreso al inicio y al final

Accesible desde el menú lateral como historial cronológico.

---

## 8. Estadísticas y Analytics (`AnalyticsView.jsx`)

Panel de estadísticas globales con:

| Métrica | Descripción |
|---|---|
| Minutos leídos total | Acumulado de todas las sesiones |
| Páginas pasadas | Contador de cambios de página |
| Racha actual | Días consecutivos con actividad |
| Racha máxima | Récord histórico de días seguidos |
| Velocidad promedio | WPM estimados `(páginas × 250) / minutos` |
| Gráfica temporal | Actividad por semana/mes |
| Desglose por horas | Log de actividad por hora del día |
| Libros terminados | Contador y porcentaje del total |
| Meta anual | Progreso hacia la meta de libros/año |

---

## 9. Logros (`achievements.js`)

Sistema de gamificación con 24 logros organizados en cuatro rarities:

| Rarity | Color |
|---|---|
| Común | Gris |
| Raro | Azul |
| Épico | Púrpura |
| Legendario | Dorado |

Los logros se evalúan tras cada acción relevante (abrir libro, pasar página, guardar vocabulario, etc.). Al desbloquear uno se muestra una notificación tipo toast.

---

## 10. Racha diaria (Streak)

- Se incrementa si hay actividad de lectura en días consecutivos.
- Si un día no hay actividad, la racha se rompe y vuelve a 0.
- Se registra la racha máxima histórica en `localStorage`.

---

## 11. Meta anual

El usuario configura cuántos libros quiere terminar en el año. El dashboard muestra el progreso en tiempo real.

---

## 12. Importación desde Goodreads (`GoodreadsImport.jsx`)

Permite importar una lista de libros en texto plano (formato CSV: `título, autor`) o pegar el CSV exportado desde Goodreads. Los libros importados se añaden como tipo `wishlist` con categoría "Pendientes".

---

## 13. Perfiles de usuario (`UserMenu.jsx`)

- Nombre de usuario y avatar (emoji seleccionable)
- Export de backup completo (JSON con todos los metadatos)
- Import de backup
- Sincronización de progreso vía archivo JSON en carpeta local compartida (Dropbox, OneDrive, etc.)
- Estadísticas de resumen en el header

---

## 14. Ajustes (`SettingsPanel.jsx`)

| Sección | Opciones |
|---|---|
| Tema | Claro / Oscuro / Sepia |
| Acento de color | Selector de color principal |
| Idioma | Español / English |
| Tipografía | Familia, tamaño base |
| Transición de página | Ninguna / Fade / Slide / Flip |
| Asociaciones de archivo | Registrar / Eliminar en Windows Registry |
| Acceso directo escritorio | Crear/eliminar acceso directo |

---

## 15. Workshop (addons)

Ver [addons-workshop.md](addons-workshop.md).

---

## 16. Series y Colecciones

Los libros se pueden asignar a:
- **Serie**: nombre de la saga + número de orden. La biblioteca puede agrupar por serie.
- **Categoría**: etiqueta libre. Cada categoría crea un filtro lateral automáticamente.

---

## 17. Búsqueda

Barra de búsqueda en la biblioteca que filtra en tiempo real por:
- Título
- Autor
- Tags
- Serie
- Sinopsis
