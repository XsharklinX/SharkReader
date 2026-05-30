import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Inyecta el Content-Security-Policy SOLO en el build de producción.
// En dev no se aplica para no romper el HMR de Vite (necesita inline/eval/ws).
const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob:",
    "connect-src 'self' data: blob: https: http:",
    "worker-src 'self' blob:",
    "frame-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
].join('; ');

const cspPlugin = {
    name: 'inject-csp-production',
    apply: 'build',
    transformIndexHtml(html) {
        return html.replace(
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
            `<meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`
        );
    },
};

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.{js,jsx}'],
    },
    plugins: [react(), cspPlugin],
    base: './',
    build: {
        outDir: 'dist-renderer',
        emptyOutDir: true,
        chunkSizeWarningLimit: 600,
        rollupOptions: {
            external: ['electron', 'path', 'fs', 'child_process', 'os', 'crypto'],
            output: {
                manualChunks(id) {
                    if (id.includes('/react-dom/') || id.includes('/react/')) return 'react-vendor';
                    if (id.includes('/pdfjs-dist/') || id.includes('\\pdfjs-dist\\')) return 'pdf-vendor';
                }
            }
        }
    },
    // epub.js uses some node globals
    define: {
        global: 'globalThis'
    },
    optimizeDeps: {
        include: ['react', 'react-dom']
    }
});
