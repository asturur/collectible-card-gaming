/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * GitHub Pages serve 404.html per ogni indirizzo che non è un file: copiandoci
 * dentro index.html, un refresh su /collectible-card-gaming/zaff riapre l'app
 * invece della pagina di errore, e il router legge il percorso come al solito.
 */
function githubPagesSpaFallback(): Plugin {
  return {
    name: 'github-pages-spa-fallback',
    apply: 'build',
    // dopo i plugin di Vite, così index.html è già nel bundle
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') {
        this.warn('index.html non trovato: 404.html non generato, gli indirizzi profondi daranno 404 su GitHub Pages');
        return;
      }
      this.emitFile({ type: 'asset', fileName: '404.html', source: index.source });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    githubPagesSpaFallback(),
  ],
  base: '/collectible-card-gaming/',
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  resolve: {
    conditions: ['import', 'module'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
