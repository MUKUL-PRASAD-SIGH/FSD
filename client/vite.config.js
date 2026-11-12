import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: proxy to the local API by default, or to a shared API when VITE_API_ORIGIN is set.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = (env.VITE_API_ORIGIN || 'http://localhost:5050').replace(/\/+$/, '');
  return {
    plugins: [react()],
    server: { port: 5173, proxy: { '/api': { target, changeOrigin: true }, '/socket.io': { target, changeOrigin: true, ws: true } } },
  };
});
