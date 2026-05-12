const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const JSZip = require('jszip');

// ── Perf flags (set before app.ready) ────────────────────────────────────────
// Enable GPU rasterization for smoother UI compositing
app.commandLine.appendSwitch('enable-gpu-rasterization');
// Prefer integrated GPU for battery; remove this line if you want discrete GPU
// app.commandLine.appendSwitch('force_low_power_gpu');
// Use V8 code cache to speed up repeated JS parsing
app.commandLine.appendSwitch('js-flags', '--harmony');
// ─────────────────────────────────────────────────────────────────────────────

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
        icon: path.join(__dirname, 'icon_build.ico'),
        backgroundColor: '#0f172a', // paint background before renderer loads (reduces white flash)
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false,   // keep timers/RAF accurate when window is hidden
            v8CacheOptions: 'bypassHeatCheck', // cache V8 bytecode from first run
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
const BOOK_EXTENSIONS = new Set(['.epub', '.pdf']);

function isBookPath(filePath) {
    return BOOK_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function walkBookFiles(dirPath) {
    const found = [];
    const stack = [dirPath];

    while (stack.length) {
        const current = stack.pop();
        let entries = [];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch (_) {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) stack.push(fullPath);
            else if (entry.isFile() && isBookPath(fullPath)) found.push(fullPath);
        }
    }

    return found;
}

async function extractEpubMeta(buffer) {
    try {
        const zip = await JSZip.loadAsync(buffer);

        let opfPath = null;
        const containerKey = Object.keys(zip.files).find(k => k.toLowerCase() === 'meta-inf/container.xml');
        if (containerKey) {
            const containerStr = await zip.files[containerKey].async('string');
            const match = containerStr.match(/full-path\s*=\s*["']([^"']+)["']/i);
            if (match) opfPath = match[1];
        }

        if (!opfPath) {
            opfPath = Object.keys(zip.files).find(k => k.toLowerCase().endsWith('.opf'));
        }
        if (!opfPath) return null;

        const opfFile = zip.file(opfPath) || Object.values(zip.files).find(f => f.name.toLowerCase() === opfPath.toLowerCase());
        if (!opfFile) return null;
        const opfStr = await opfFile.async('string');

        const findTag = (tag) => {
            const regex = new RegExp(`<[^:>]*:?${tag}[^>]*>([\\s\\S]*?)</[^:>]*:?${tag}>`, 'i');
            const match = opfStr.match(regex);
            return match
                ? match[1]
                    .replace(/<!\[CDATA\[|\]\]>/g, '')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .trim()
                : '';
        };

        const getAttr = (xml, attr) => {
            const match = xml.match(new RegExp(`\\s${attr}\\s*=\\s*["']([^"']+)["']`, 'i'));
            return match ? match[1] : '';
        };

        const title = findTag('title');
        const creator = findTag('creator');
        const description = findTag('description');
        const publisher = findTag('publisher');
        const subject = findTag('subject');

        const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
        const items = [];
        const itemRegex = /<item\b[^>]*>/gi;
        let itemMatch;
        while ((itemMatch = itemRegex.exec(opfStr))) {
            const xml = itemMatch[0];
            const href = getAttr(xml, 'href');
            const mediaType = getAttr(xml, 'media-type');
            if (!href) continue;
            items.push({
                id: getAttr(xml, 'id'),
                href,
                mediaType,
                properties: getAttr(xml, 'properties'),
            });
        }

        let coverHref = null;

        const coverImage = items.find(item =>
            item.mediaType?.startsWith('image/') &&
            /\bcover-image\b/i.test(item.properties || '')
        );
        if (coverImage) coverHref = coverImage.href;

        if (!coverHref) {
            const metaRegex = /<meta\b[^>]*>/gi;
            let metaMatch;
            while ((metaMatch = metaRegex.exec(opfStr))) {
                const xml = metaMatch[0];
                if (getAttr(xml, 'name').toLowerCase() === 'cover') {
                    const coverId = getAttr(xml, 'content');
                    const coverItem = items.find(item => item.id === coverId);
                    if (coverItem?.mediaType?.startsWith('image/')) {
                        coverHref = coverItem.href;
                        break;
                    }
                }
            }
        }

        if (!coverHref) {
            const hinted = items.find(item => {
                const hint = `${item.id || ''} ${item.href || ''}`.toLowerCase();
                return item.mediaType?.startsWith('image/') && /(cover|portada|front|titlepage)/i.test(hint);
            });
            if (hinted) coverHref = hinted.href;
        }

        if (!coverHref) {
            const firstImage = items.find(item => item.mediaType?.startsWith('image/'));
            if (firstImage) coverHref = firstImage.href;
        }

        let coverBase64 = null;
        if (coverHref) {
            let cleanHref = decodeURIComponent(coverHref.replace(/&amp;/g, '&')).split('#')[0].split('?')[0];
            let fullPath = cleanHref.startsWith('/') ? cleanHref.slice(1) : (opfDir + cleanHref);

            const parts = [];
            for (const p of fullPath.split('/')) {
                if (p === '..') parts.pop();
                else if (p && p !== '.') parts.push(p);
            }
            fullPath = parts.join('/');

            const coverFile = zip.file(fullPath) || Object.values(zip.files).find(f => f.name.toLowerCase() === fullPath.toLowerCase());
            if (coverFile) {
                const data = await coverFile.async('base64');
                const ext = fullPath.split('.').pop().toLowerCase();
                const mime = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', svg:'image/svg+xml' }[ext] || 'image/jpeg';
                coverBase64 = `data:${mime};base64,${data}`;
            }
        }

        return { title, creator, description, publisher, subject, coverBase64 };
    } catch (e) {
        console.error('[SharkReader] Native extract failed:', e);
        return null;
    }
}

async function readBookPayload(filePath) {
    try {
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let meta = null;
        if (ext === '.epub') {
            try {
                meta = await extractEpubMeta(data);
            } catch (err) {
                console.error('[SharkReader] Error en metadata de main.js:', err);
            }
        }

        return {
            name: path.basename(filePath),
            path: filePath,
            type: ext === '.pdf' ? 'application/pdf' : 'application/epub+zip',
            lastModified: fs.statSync(filePath).mtimeMs,
            dataBase64: data.toString('base64'),
            meta
        };
    } catch (err) {
        console.error('readBookPayload falló para', filePath, err);
        throw err;
    }
}

function readBookPayloads(filePaths) {
    return Promise.all(filePaths
        .filter(isBookPath)
        .map(async filePath => {
            try {
                return await readBookPayload(filePath);
            } catch (err) {
                console.error('[SharkReader] No se pudo leer libro:', filePath, err);
                return null;
            }
        })
    ).then(res => res.filter(Boolean));
}

ipcMain.handle('pick-book-files', async () => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Libros', extensions: ['epub', 'pdf'] }],
        title: 'Añadir libros'
    });
    if (result.canceled) return [];
    return readBookPayloads(result.filePaths);
});

ipcMain.handle('pick-book-folder', async () => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Añadir carpeta de libros'
    });
    if (result.canceled || !result.filePaths[0]) return [];
    return await readBookPayloads(walkBookFiles(result.filePaths[0]));
});

ipcMain.handle('read-book-file', async (_e, filePath) => {
    if (!filePath || !isBookPath(filePath)) return null;
    try {
        return await readBookPayload(filePath);
    } catch (err) {
        console.error('[SharkReader] No se pudo abrir libro desde ruta:', filePath, err);
        return null;
    }
});

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
