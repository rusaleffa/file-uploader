import { defineConfig } from 'vite';

export default defineConfig({
    worker: {
        format: 'es',
    },
    build: {
        target: 'es2022',
    },
    optimizeDeps: {
        // jpg-stream  Node-модуль, Vite его не должен пытаться оптимизировать.
        exclude: ['@stealthybox/jpg-stream'],
    },
});