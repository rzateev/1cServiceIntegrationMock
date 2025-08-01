import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Загружаем переменные окружения для текущего режима (development, production)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT) || 3090,
      host: '0.0.0.0', // Обязательно для Docker
      allowedHosts: 'all', // Разрешаем доступ со всех хостов
      proxy: {
        // Проксируем только то, что начинается с /api/
        '/api/': {
          target: env.VITE_API_TARGET || 'http://localhost:9090',
          changeOrigin: true,
        },
        // И запросы аутентификации
        '/auth': {
          target: env.VITE_API_TARGET || 'http://localhost:9090',
          changeOrigin: true,
        }
      }
    },
    // Явно указываем, что это SPA, чтобы все пути отдавались в index.html
    appType: 'spa',
  };
});
