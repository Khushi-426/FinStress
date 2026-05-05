import axios from "axios";

const api = axios.create({
  baseURL: (process.env.REACT_APP_API_URL || 'http://localhost:5000') + '/api',
  timeout: 15000,
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;

    // 1. Handle Token Expiry
    if (err.response?.status === 401 && err.response?.data?.code === 'TOKEN_EXPIRED') {
      localStorage.removeItem('fs_token');
      window.location.href = '/login';
      return Promise.reject(new Error('Session expired. Please log in again.'));
    }

    // 2. Retry logic for timeouts or server errors
    if (!config.retryCount) config.retryCount = 0;
    if ((err.code === 'ECONNABORTED' || err.response?.status >= 500) && config.retryCount < 3) {
      config.retryCount++;
      const delay = Math.pow(2, config.retryCount) * 1000; // 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, delay));
      return api(config);
    }

    return Promise.reject(new Error(err.response?.data?.error || err.message));
  }
);

export default api;
