import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    root: path.join(root, 'src/client'),
    base: './',
    // Existing fonts retain their names, CSS, inventory and license files.
    publicDir: path.join(root, 'src/client/assets'),
    plugins: [react()],
    build: {
        outDir: path.join(root, 'dist/renderer'),
        emptyOutDir: true,
        assetsInlineLimit: 0,
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        fs: { allow: [root] },
        proxy: {
            // Preserve Host so the API's same-origin check also works through Vite.
            '/api': { target: `http://127.0.0.1:${process.env.PORT || 8095}`, changeOrigin: false },
        },
    },
});
