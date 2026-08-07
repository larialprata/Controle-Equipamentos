import axios from 'axios';

// Base URL da API para as requisições do frontend.
// Em produção, a partir do navegador, "localhost" aponta para a máquina do usuário,
// então precisamos de uma URL acessível ao cliente (ou usar reverse proxy no Nginx).
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE_URL = (
  configuredApiBaseUrl || (import.meta.env.DEV ? 'http://localhost:3000' : '')
).replace(/\/+$/, '');

if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL não foi definida para o build de produção.');
}

const client = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor to add token and Content-Type correto por tipo de body
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
    if (isFormData) {
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
      } else {
        delete config.headers['Content-Type'];
      }
    } else if (config.data !== undefined && config.data !== null) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Handle unauthorized access (e.g., clear token and redirect to login)
      // We'll let the auth store or component handle the redirect, 
      // but we can clear the token here to be safe.
      // localStorage.removeItem('token'); 
      // Not clearing immediately to avoid race conditions, let the app logic handle it.
    }
    return Promise.reject(error);
  }
);

export default client;
export { API_BASE_URL };
