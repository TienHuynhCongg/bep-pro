import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {createKitchenApiMiddleware} from './server.ts';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'kitchen-realtime-api-v2',
        configureServer(server) {
          server.middlewares.use(createKitchenApiMiddleware() as any);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // Bỏ qua thư mục data/ (kitchen-db.json) để mỗi lần lưu dữ liệu không làm Vite reload cả trang về trang chính.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/data/**', '**/dist/**'] },
    },
  };
});
