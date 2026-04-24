const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

delete process.env.ELECTRON_RUN_AS_NODE;

const rootDir = path.join(__dirname, '..');

// Start Vite dev server
const vite = spawn('npx', ['vite', '--port', '5173'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
});

vite.stdout.pipe(process.stdout);
vite.stderr.pipe(process.stderr);

// Poll until Vite is ready, then launch Electron
function waitForVite(retries, cb) {
    http.get('http://localhost:5173', (res) => {
        cb();
    }).on('error', () => {
        if (retries <= 0) { console.error('Vite server did not start.'); process.exit(1); }
        setTimeout(() => waitForVite(retries - 1, cb), 300);
    });
}

waitForVite(40, () => {
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
    if (code !== null) { console.error('Vite exited unexpectedly.'); process.exit(code); }
});
