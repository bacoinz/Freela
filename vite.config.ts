/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// A app é 100% local: nada de CDNs nem pedidos externos.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // O Capacitor serve a app na raiz (https://localhost/), por isso caminhos absolutos.
  base: '/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
