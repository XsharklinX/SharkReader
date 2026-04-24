const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

let mainWindow = null;

// Extraer ruta de archivo epub/mobi de los argumentos
function getFileFromArgs(argv) {
    return argv.slice(1).find(a => /\.(epub|mobi|pdf)$/i.test(a)) || null;
}

// Single-instance: si ya hay una ventana abierta, enfócarla y enviarle el archivo
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', (_event, argv) => {
        const filePath = getFileFromArgs(argv);
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            if (filePath) mainWindow.webContents.send('open-file', filePath);
        }
    });
}

const isDev = process.env.VITE_DEV === '1';

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist-renderer', 'index.html'));
    }

    // Enviar archivo al renderer cuando esté listo
    const startFile = getFileFromArgs(process.argv);
    if (startFile) {
        mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('open-file', startFile);
        });
    }

    mainWindow.on('closed', () => { mainWindow = null; });
}

// Seleccionar carpeta de sincronización
ipcMain.handle('pick-folder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Carpeta de sincronización de progreso'
    });
    return result.canceled ? null : result.filePaths[0];
});

// Escribir archivo de sync
ipcMain.handle('write-sync-file', async (_e, folderPath, content) => {
    try {
        fs.writeFileSync(path.join(folderPath, 'sharkreader_sync.json'), content, 'utf-8');
        return { ok: true };
    } catch (err) {
        return { ok: false, msg: err.message };
    }
});

// Leer archivo de sync
ipcMain.handle('read-sync-file', async (_e, folderPath) => {
    try {
        const content = fs.readFileSync(path.join(folderPath, 'sharkreader_sync.json'), 'utf-8');
        return { ok: true, content };
    } catch {
        return { ok: false };
    }
});

// Registrar asociaciones de archivo en Windows (requiere permisos de admin)
ipcMain.handle('register-file-associations', async () => {
    if (process.platform !== 'win32') return { ok: false, msg: 'Solo disponible en Windows' };

    const exePath = process.execPath.replace(/\\/g, '\\\\');
    const appDir = __dirname.replace(/\\/g, '\\\\');
    // El comando que Windows usará para abrir el archivo:
    // electron.exe "ruta/al/proyecto" "%1"
    const openCmd = `\\"${exePath}\\" \\"${appDir}\\" \\"%1\\"`;

    const formats = [
        { ext: '.epub', progId: 'SharkReader.epub', desc: 'EPUB Document' },
        { ext: '.mobi', progId: 'SharkReader.mobi', desc: 'MOBI Document' },
    ];

    try {
        for (const fmt of formats) {
            // Asociar extensión al ProgId
            execSync(`reg add "HKCU\\Software\\Classes\\${fmt.ext}" /ve /d "${fmt.progId}" /f`);
            execSync(`reg add "HKCU\\Software\\Classes\\${fmt.ext}" /v "Content Type" /d "application/epub+zip" /f`);

            // Registrar ProgId
            execSync(`reg add "HKCU\\Software\\Classes\\${fmt.progId}" /ve /d "${fmt.desc} — Shark Reader" /f`);

            // Ícono
            execSync(`reg add "HKCU\\Software\\Classes\\${fmt.progId}\\DefaultIcon" /ve /d "${exePath},0" /f`);

            // Comando de apertura
            execSync(`reg add "HKCU\\Software\\Classes\\${fmt.progId}\\shell\\open\\command" /ve /d "${openCmd}" /f`);
        }

        // Notificar a Explorer para que refresque los iconos
        execSync('ie4uinit.exe -show', { stdio: 'ignore' });

        return { ok: true, msg: 'Asociaciones registradas correctamente' };
    } catch (err) {
        return { ok: false, msg: err.message };
    }
});

ipcMain.handle('remove-file-associations', async () => {
    if (process.platform !== 'win32') return { ok: false };
    try {
        execSync('reg delete "HKCU\\Software\\Classes\\SharkReader.epub" /f');
        execSync('reg delete "HKCU\\Software\\Classes\\SharkReader.mobi" /f');
        execSync('reg delete "HKCU\\Software\\Classes\\.epub" /f');
        execSync('reg delete "HKCU\\Software\\Classes\\.mobi" /f');
        return { ok: true };
    } catch (err) {
        return { ok: false, msg: err.message };
    }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
