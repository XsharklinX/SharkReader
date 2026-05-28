const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');

// Clean up proxy env vars that might interfere with localhost/loopback requests
delete process.env.http_proxy;
delete process.env.https_proxy;
delete process.env.HTTP_PROXY;
delete process.env.HTTPS_PROXY;
delete process.env.all_proxy;
delete process.env.ALL_PROXY;
delete process.env.no_proxy;
delete process.env.NO_PROXY;

delete process.env.ELECTRON_RUN_AS_NODE;

const rootDir = path.join(__dirname, '..');
// Use 'localhost' so polling resolves to the same interface Vite binds to.
// Node 25 resolves 'localhost' to ::1 (IPv6) — same as Vite's default, avoiding mismatch.
const viteHost = 'localhost';
const vitePort = '5173';

// Kill any lingering process on the Vite port before starting.
// Prevents --strictPort from causing an immediate exit on second runs.
try {
    if (process.platform === 'win32') {
        const out = execSync(`netstat -ano -p TCP 2>nul | findstr ":${vitePort} "`, { encoding: 'utf8' });
        const pids = [...new Set(
            out.split('\n')
                .map(l => l.trim().split(/\s+/).pop())
                .filter(p => p && /^\d+$/.test(p) && p !== '0')
        )];
        pids.forEach(pid => {
            try { execSync(`taskkill /F /PID ${pid} 2>nul`); } catch (_) {}
        });
    }
} catch (_) {}

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
console.log('⚡ [SharkReader] Starting Vite dev server...');

const vite = spawn(process.execPath, [viteBin, '--port', vitePort, '--strictPort'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
});

vite.on('error', (err) => {
    console.error('Vite spawn error:', err);
});

vite.stdout.pipe(process.stdout);
vite.stderr.pipe(process.stderr);
vite.stdout.on('data', rememberOutput);
vite.stderr.on('data', rememberOutput);

let lastError = null;

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
    }).on('error', (err) => {
        lastError = err;
        if (retries <= 0) {
            console.error(`Vite server did not start at http://${viteHost}:${vitePort}.`);
            console.error('Last connection error:', lastError);
            if (viteLastOutput.trim()) console.error(viteLastOutput.trim());
            process.exit(1);
        }
        setTimeout(() => waitForVite(retries - 1, cb), 300);
    });
}

// Small initial delay so Vite has time to either bind or crash before the
// first poll fires — prevents false "retries exhausted" when Vite exits fast.
setTimeout(() => waitForVite(120, () => {
    const electronBin = require('electron');
    const electron = spawn(electronBin, [rootDir], {
        stdio: 'inherit',
        env: { ...process.env, VITE_DEV: '1' }
    });
    electron.on('exit', (code) => {
        vite.kill();
        process.exit(code ?? 0);
    });
}), 600);

vite.on('exit', (code) => {
    viteExited = true;
    viteExitCode = code;
    if (code !== null) { console.error('Vite exited unexpectedly.'); process.exit(code); }
});
