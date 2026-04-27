# Sistema de Addons — Workshop

El Workshop es un panel modal que permite activar y desactivar funciones opcionales de la aplicación sin reiniciarla. El estado de cada addon se persiste en `localStorage` bajo la clave `sharkreader_addons`.

---

## Addons disponibles

### Activos

| ID | Nombre | Categoría | Contexto | Descripción |
|---|---|---|---|---|
| `focusMode` | Modo Focus | Lectura | Lector | La barra superior desaparece tras 2.5 s de inactividad. Mover el ratón al borde superior la recupera. |
| `autoBookmark` | Marcador Automático | Lectura | Lector | Guarda la posición actual como marcador cada vez que se cierra un libro. |
| `dyslexiaFont` | Fuente Dislexia | Accesibilidad | Lector | Sustituye la fuente del lector EPUB por OpenDyslexic. |
| `netflixView` | Vista Netflix | Interfaz | Biblioteca | Portadas más grandes. Hover muestra título, autor y progreso. |
| `readingJournal` | Reading Journal | Estadísticas | Global | Registra automáticamente cada sesión de lectura con fecha, libro y progreso. |
| `reminders` | Recordatorio Diario | Productividad | Global | Notificación del sistema si llevas más de 1 h sin abrir la app. |
| `xray` | X-Ray | Lectura | Lector | Panel lateral con personajes, lugares y términos del libro. Permite añadir entradas por selección de texto. |
| `smartToc` | TOC Flotante | Navegación | Lector | Tabla de contenidos flotante que indica la posición actual mientras se lee. |

### Próximamente

| ID | Nombre | Categoría | Descripción |
|---|---|---|---|
| `smartQuotes` | Citas con IA | IA | La IA detecta frases destacables y propone guardarlas como subrayados. |
| `cloudSync` | Sync en la Nube | Datos | Sincroniza progreso, notas y marcadores entre dispositivos. |

---

## Contextos de addon

| Contexto | Significado |
|---|---|
| `reader` | Solo tiene efecto cuando hay un libro abierto en el lector |
| `library` | Cambia la interfaz de la biblioteca |
| `global` | Activo en toda la aplicación |

---

## Arquitectura del sistema

### Definición de addons (`WorkshopPanel.jsx`)

```js
const ADDONS = [
  {
    id: 'focusMode',
    emoji: '🎯',
    name: 'Modo Focus',
    desc: '...',
    category: 'Lectura',
    context: 'reader',
    status: 'active',   // 'active' | 'soon'
  },
  // ...
];
```

### Estado (`App.jsx`)

```js
const [addons, setAddons] = useState(
  () => safeParse('sharkreader_addons', {})
);
```

### Toggle

```js
const handleAddonToggle = (id) => {
  setAddons(prev => {
    const next = { ...prev, [id]: !prev[id] };
    localStorage.setItem('sharkreader_addons', JSON.stringify(next));
    return next;
  });
};
```

### Consumo en componentes

Los addons se pasan como props a los componentes que los implementan:

```jsx
<EpubReader
  focusModeAddon={addons.focusMode}
  dyslexiaFontAddon={addons.dyslexiaFont}
  autoBookmarkAddon={addons.autoBookmark}
  xrayAddon={addons.xray}
  smartTocAddon={addons.smartToc}
/>
```

Cada componente aplica la lógica del addon condicionalmente según el valor booleano recibido.

---

## UI del Workshop

El panel se abre desde el botón del topbar (icono de llave inglesa 🔧).

Elementos de la UI:
1. **Header**: título, contador de addons activos, botón de cierre.
2. **Barra de activos**: pills de los addons habilitados con clic para desactivar.
3. **Tabs de categoría**: filtro por categoría (Todos, Lectura, Interfaz…).
4. **Grid de addons**: 2 columnas en desktop. Cada card muestra emoji, nombre, badge de contexto, descripción y toggle.
5. **Nota informativa**: recuerda al usuario que los addons "En el lector" solo funcionan con un libro abierto.

### Feedback visual en toggle

Al activar/desactivar un addon:
- El card emite un destello con `box-shadow: 0 0 0 3px var(--highlight)`
- Un overlay semitransparente del color de acento aparece y hace fade-out en 1.2 s
- La clase CSS `fadeOut` se aplica vía `@keyframes fadeOut` en `main.css`

---

## Añadir un nuevo addon

1. Añadir un objeto al array `ADDONS` en `WorkshopPanel.jsx` con `status: 'active'`.
2. Pasarlo como prop desde `App.jsx` al componente destino.
3. Implementar la lógica condicional en el componente con `if (!addonProp) return;` o similar.
4. Si el addon afecta estilos, añadir las clases CSS necesarias a `styles/main.css`.
