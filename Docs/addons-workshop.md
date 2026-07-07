# Workshop de Addons

El Workshop permite activar funciones opcionales sin ensuciar el nucleo de SharkReader. La regla actual es: el addon declara metadata, config y capacidades en un registro central; los componentes solo consumen flags/config ya normalizados.

## Fuente de verdad

Archivo principal:

```text
src/workshopModules.js
```

Responsabilidades:

- `WORKSHOP_ADDONS`: registro publico de addons.
- `WORKSHOP_CATEGORIES`: categorias visibles en el panel.
- `WORKSHOP_MATURITY`: separacion entre `stable` y `experimental`.
- `normalizeAddonState`: crea el mapa booleano por addon.
- `normalizeAddonConfig`: fusiona defaults con datos persistidos y sanea valores.
- `validateAddonToggle`: bloquea toggles invalidos y exige confirmacion para experimentales.
- `migrateWorkshopData`: payload versionado para backup/import/sync.

El panel visual vive en:

```text
src/WorkshopPanel.jsx
```

## Contrato minimo de addon

Cada addon debe tener:

```js
{
  id: 'miAddon',
  emoji: '...',
  name: { es: 'Nombre', en: 'Name' },
  desc: { es: 'Descripcion', en: 'Description' },
  category: 'reading',
  context: 'reader',
  status: 'active',
  defaultEnabled: false,
  defaultConfig: {},
  maturity: 'stable',
  api: ['reader.location'],
  configSchema: {},
  lifecycle: { configurable: false, migratable: true }
}
```

No se deben declarar addons dentro de `WorkshopPanel.jsx`.

## Madurez

### Stable

Addon probado, con comportamiento claro y bajo riesgo. Puede activarse directamente.

### Experimental

Addon que toca filesystem, integraciones externas, backups, watchers o APIs que pueden cambiar. El panel pide confirmacion antes de activarlo.

Actualmente experimentales:

- `externalSources`
- `watchedFolder`
- `autoBackup`

## Configuracion

La config se define por addon en `ADDON_CONFIG_SCHEMA`.

Tipos soportados:

- `number`
- `nullableNumber`
- `boolean`
- `enum`
- `string`

Ejemplo:

```js
soundFeedback: {
  volume: { type: 'number', min: 0, max: 100, fallback: 50 },
  pageTurn: { type: 'boolean', fallback: true }
}
```

Toda config persistida pasa por `normalizeAddonConfig`, asi que valores corruptos o fuera de rango vuelven a un fallback seguro.

## API interna minima

El campo `api` no carga codigo dinamico. Es un contrato documental y visual para saber que toca cada addon.

Ejemplos:

- `reader.location`
- `bookmarks.write`
- `library.view`
- `filesystem.read`
- `backup.export`
- `audio.play`
- `ui.overlay`

Regla: si un addon necesita una capacidad nueva, primero se anade al `api` del registro y luego se implementa en el componente o hook correspondiente.

## Persistencia

Estado actual:

- `addons`: `{ [addonId]: boolean }`
- `addonConfig`: `{ [addonId]: object }`
- `workshop`: payload combinado y versionado

La app persiste en IndexedDB mediante `saveAppData`. Algunas claves legacy en localStorage existen solo como fallback/migracion.

## UI actual

El Workshop muestra:

- Header con contador de activos.
- Barra de addons activos para desactivar rapido.
- Filtro por scope: `Todos`, `Instalados`, `Estables`, `Experimentales`.
- Filtro por categoria.
- Cards con contexto, madurez y capacidades API.
- Config inline para addons configurables.
- Fuentes externas en seccion separada.

## Como agregar un addon

1. Agregar metadata en `WORKSHOP_ADDONS`.
2. Definir `ADDON_MATURITY[id]`.
3. Definir `ADDON_API[id]`.
4. Si tiene config, agregar `defaultConfig` y `ADDON_CONFIG_SCHEMA[id]`.
5. Implementar consumo del flag/config en el componente/hook apropiado.
6. Si toca datos o backup, revisar `migrateWorkshopData`.
7. Documentar comportamiento y riesgo.

## Reglas de estabilidad

- No meter logica funcional nueva dentro de `WorkshopPanel.jsx`.
- No crear addons ad hoc en `App.jsx`.
- No activar experimentales sin confirmacion del usuario.
- No guardar config sin normalizar.
- No tocar filesystem/red desde el renderer sin pasar por IPC/preload seguro.
