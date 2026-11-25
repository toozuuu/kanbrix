import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? new URL(process.env.SITE_URL ?? '').pathname.replace(/\/?$/, '/') : '/',
  plugins: [
    react(),
    mode === 'pages' && {
      name: 'kanbrix-pages-entry',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replace('/src/main.tsx', '/src/pages-main.tsx'),
      },
    },
  ],
  optimizeDeps: { include: ["flatpickr", "codemirror", "@codemirror/lang-html", "@codemirror/theme-one-dark"] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@tiptap') || id.includes('prosemirror') || id.includes('lowlight')) return 'vendor-editor';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
          if (id.includes('i18next')) return 'vendor-i18n';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/setupTests.ts'],
    },
  },
}));
