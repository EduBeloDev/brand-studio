import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Testes do núcleo e da API rodam no Node; os da interface declaram jsdom no topo do arquivo.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['core/**/*.test.ts', 'web/**/*.test.ts', 'web/app/src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'web/dist/**'],
  },
});
