import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: { hmr: false }, 
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
      'node-domexception': path.resolve(process.cwd(), './src/lib/domexception-shim.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
  },
});
