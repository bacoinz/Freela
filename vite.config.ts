/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

// A app é 100% local: nada de CDNs nem pedidos externos.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // O Capacitor serve a app na raiz (https://localhost/), por isso caminhos absolutos.
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
