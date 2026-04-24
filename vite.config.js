import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: './',
    build: {
        outDir: 'dist-renderer',
        emptyOutDir: true,
        rollupOptions: {
            external: ['electron', 'path', 'fs', 'child_process', 'os', 'crypto']
        }
    },
    // epub.js uses some node globals
    define: {
        global: 'globalThis'
    },
    optimizeDeps: {
        include: ['react', 'react-dom', 'epubjs']
    }
});
