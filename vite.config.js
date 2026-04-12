import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const deepseekKey = env.VITE_DEEPSEEK_API_KEY || '';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Browser → api.deepseek.com hits CORS; proxy in dev so the AI panel works with only .env.
    server: {
      proxy: {
        '/deepseek-api': {
          target: 'https://api.deepseek.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/deepseek-api/, ''),
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              if (deepseekKey) {
                proxyReq.setHeader('Authorization', `Bearer ${deepseekKey}`);
              }
            });
          },
        },
      },
    },
  };
});
