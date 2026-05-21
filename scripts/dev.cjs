const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

delete process.env.ELECTRON_RUN_AS_NODE;

const rootDir = path.join(__dirname, '..');
const viteHost = '127.0.0.1';
const vitePort = '5173';
const vitePackagePath = require.resolve('vite/package.json');
const vitePackage = require(vitePackagePath);
const viteBin = path.join(path.dirname(vitePackagePath), vitePackage.bin.vite);
let viteExited = false;
let viteExitCode = null;
let viteLastOutput = '';

const rememberOutput = (chunk) => {
    viteLastOutput = (viteLastOutput + chunk.toString()).slice(-4000);
};

// Start Vite dev server
const vite = spawn(process.execPath, [viteBin, '--host', viteHost, '--port', vitePort, '--strictPort'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
});

vite.stdout.pipe(process.stdout);
vite.stderr.pipe(process.stderr);
vite.stdout.on('data', rememberOutput);
vite.stderr.on('data', rememberOutput);

// Poll until Vite is ready, then launch Electron
function waitForVite(retries, cb) {
    if (viteExited) {
        console.error(`Vite exited before startup. Exit code: ${viteExitCode ?? 'unknown'}`);
        if (viteLastOutput.trim()) console.error(viteLastOutput.trim());
        process.exit(viteExitCode ?? 1);
    }

    http.get(`http://${viteHost}:${vitePort}`, (res) => {
        res.resume();
        cb();
    }).on('error', () => {
        if (retries <= 0) {
            console.error(`Vite server did not start at http://${viteHost}:${vitePort}.`);
            if (viteLastOutput.trim()) console.error(viteLastOutput.trim());
            process.exit(1);
        }
        setTimeout(() => waitForVite(retries - 1, cb), 300);
    });
}

waitForVite(100, () => {
    const electronBin = require('electron');
    const electron = spawn(electronBin, [rootDir], {
        stdio: 'inherit',
        env: { ...process.env, VITE_DEV: '1' }
    });
    electron.on('exit', (code) => {
        vite.kill();
        process.exit(code ?? 0);
    });
});

vite.on('exit', (code) => {
    viteExited = true;
    viteExitCode = code;
    if (code !== null) { console.error('Vite exited unexpectedly.'); process.exit(code); }
});
