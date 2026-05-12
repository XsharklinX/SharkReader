import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
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
