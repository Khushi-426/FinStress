import axios from 'axios';
const api = axios.create({ baseURL: '/api', timeout: 15000 });
api.interceptors.response.use(r => r, err => Promise.reject(new Error(err.response?.data?.error || err.message)));
export default api;
