import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// A interface é construída em web/dist e servida pelo próprio servidor do app (npm run painel).
// No modo de desenvolvimento (npm run dev), o Vite repassa /api e /pecas para o servidor na porta 3000.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': 'http://127.0.0.1:3000', '/pecas': 'http://127.0.0.1:3000' } },
});
