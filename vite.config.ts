import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const appsScriptUrl = env.VITE_APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL || '';
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      https: {},
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
