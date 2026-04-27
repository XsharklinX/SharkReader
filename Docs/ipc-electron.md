# IPC — Comunicación Main ↔ Renderer

La comunicación entre el Main Process (`main.js`) y el Renderer (`src/`) usa el módulo `ipcRenderer` / `ipcMain` de Electron. `contextIsolation` está desactivado, por lo que el renderer accede a IPC directamente con:

```js
const { ipcRenderer } = window.require('electron');
```

---

## Canales registrados

### `pick-folder`

**Dirección:** Renderer → Main  
**Descripción:** Abre el diálogo nativo del sistema para seleccionar una carpeta.  
**Uso:** Elegir la carpeta de sincronización de progreso.

```js
// Renderer
const folderPath = await ipcRenderer.invoke('pick-folder');
// Retorna: string (ruta absoluta) | null (si el usuario cancela)
```

---

### `write-sync-file`

**Dirección:** Renderer → Main  
**Descripción:** Escribe el archivo `sharkreader_sync.json` en la carpeta especificada.

```js
// Renderer
const result = await ipcRenderer.invoke('write-sync-file', folderPath, jsonContent);
// Retorna: { ok: boolean, msg?: string }
```

El archivo resultante: `{folderPath}/sharkreader_sync.json`

---

### `read-sync-file`

**Dirección:** Renderer → Main  
**Descripción:** Lee el archivo `sharkreader_sync.json` de la carpeta especificada.

```js
// Renderer
const result = await ipcRenderer.invoke('read-sync-file', folderPath);
// Retorna: { ok: boolean, content?: string }
```

---

### `register-file-associations`

**Dirección:** Renderer → Main  
**Descripción:** Registra las extensiones `.epub` y `.mobi` en el Registro de Windows (`HKCU\Software\Classes`) para que SharkReader sea la aplicación predeterminada.

```js
// Renderer
const result = await ipcRenderer.invoke('register-file-associations');
// Retorna: { ok: boolean, msg: string }
```

Requiere que el proceso tenga permisos de escritura en `HKCU` (normalmente no requiere UAC). Ejecuta comandos `reg add` mediante `execSync`.

Registros creados:

```
HKCU\Software\Classes\.epub  →  SharkReader.epub
HKCU\Software\Classes\.mobi  →  SharkReader.mobi
HKCU\Software\Classes\SharkReader.epub\shell\open\command  →  "electron.exe" "appDir" "%1"
HKCU\Software\Classes\SharkReader.mobi\shell\open\command  →  "electron.exe" "appDir" "%1"
```

---

### `remove-file-associations`

**Dirección:** Renderer → Main  
**Descripción:** Elimina del Registro los ProgIDs y extensiones registradas por `register-file-associations`.

```js
// Renderer
const result = await ipcRenderer.invoke('remove-file-associations');
// Retorna: { ok: boolean, msg?: string }
```

---

## Evento de apertura de archivo

**Canal:** `open-file`  
**Dirección:** Main → Renderer  
**Descripción:** Notifica al Renderer que debe abrir un archivo específico. Se dispara en dos escenarios:

1. **Arranque con archivo:** El usuario abre SharkReader haciendo doble clic en un `.epub`/`.pdf`. El argumento llega en `process.argv`.
2. **Segunda instancia:** El usuario intenta abrir SharkReader con otro archivo mientras ya está corriendo. El lock de instancia única (`requestSingleInstanceLock`) captura el evento y lo reenvía a la ventana existente.

```js
// Main
mainWindow.webContents.send('open-file', filePath);

// Renderer
ipcRenderer.on('open-file', (_event, filePath) => {
  // Importar y abrir el archivo
});
```

---

## Seguridad IPC

La configuración actual de `BrowserWindow`:

```js
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false,
  webSecurity: false
}
```

- `nodeIntegration: true` y `contextIsolation: false` permiten usar `require('electron')` directamente en el renderer. Esto es adecuado para aplicaciones de escritorio cerradas sin contenido web de terceros.
- `webSecurity: false` es necesario para cargar archivos locales (EPUB/PDF) desde rutas del sistema de archivos con `createObjectURL`.

> Para una versión futura de producción, se recomienda migrar a `contextIsolation: true` con un `preload.js` que exponga únicamente los canales IPC necesarios vía `contextBridge`.
