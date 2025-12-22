import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000, // Increase limit to 1000 KB (1 MB)
  },
  server: {
    port: 5173,
  },
});

