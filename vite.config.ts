import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const appsScriptUrl = env.VITE_APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL || '';
  return {
    server: {
      port: 3005,
      host: '0.0.0.0',
      proxy: {
        '/api-python': {
          target: 'https://localhost:8000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api-python/, ''),
        },
        '/api-node': {
          target: 'http://localhost:8001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-node/, ''),
        }
      }
    },
    plugins: [
      react(),
      basicSsl(),
    ],
    define: {
      'import.meta.env.VITE_APPS_SCRIPT_URL': JSON.stringify(appsScriptUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
