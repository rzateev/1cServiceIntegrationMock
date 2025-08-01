import axios from 'axios';
import { message } from 'antd';

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/',
});

instance.interceptors.request.use((config) => {
  // Проверяем, нужно ли пропустить автоматическую авторизацию
  if (config.headers && (config.headers as any)['skipAuth']) {
    delete (config.headers as any)['skipAuth'];
    return config; // Возвращаем конфиг без добавления Bearer токена
  }
  
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Централизованный обработчик ошибок
instance.interceptors.response.use(
  (response) => response, // Успешные ответы просто пробрасываем дальше
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data;
      let errorMessage = errorData?.message || `Ошибка: ${error.response.status}`;

      // Проверяем, есть ли детальные ошибки от Zod
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        const detailedErrors = errorData.errors.map((e: any) => `${e.path}: ${e.message}`).join('\n');
        errorMessage = `${errorMessage}\n${detailedErrors}`;
      }

      // Показываем ошибку пользователю
      message.error(errorMessage, 7); // Увеличим время отображения до 7 секунд
    } else {
      // Для не-axios ошибок или ошибок сети
      message.error('Произошла непредвиденная ошибка сети');
    }
    // Важно пробросить ошибку дальше, чтобы .catch() в компонентах сработал
    return Promise.reject(error);
  }
);

export default instance; 