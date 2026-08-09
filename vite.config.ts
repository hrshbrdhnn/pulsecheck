import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Configure Hot Module Replacement (HMR) dynamically
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching if DISABLE_HMR is set to true
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://localhost:3002',
          ws: true,
        },
      },
    },
  };
});
