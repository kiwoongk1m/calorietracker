import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During dev, proxy /api/* to the backend Express server so the frontend can
// call the real contract endpoints (served by mocks in Stage 1). In production
// the same paths are served by serverless functions in /api.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
