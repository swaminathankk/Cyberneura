import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const api = axios.create({
    baseURL: `${BASE_URL}/api/v1`,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
});

// Response interceptor — unwrap data, surface errors
api.interceptors.response.use(
    (res) => res.data,
    (err) => {
        const message =
            err.response?.data?.error ||
            err.response?.data?.message ||
            err.message ||
            'Request failed';
        return Promise.reject(new Error(message));
    }
);

export const scanApi = {
    /** Scan a single URL */
    scanUrl: (url) => api.post('/scan/url', { url }),

    /** Scan an email/text block */
    scanEmail: (content) => api.post('/scan/email', { content }),

    /** Bulk scan */
    scanBulk: (urls) => api.post('/scan/bulk', { urls }),

    /** Get paginated history */
    getHistory: (page = 1, limit = 20) =>
        api.get(`/scan/history?page=${page}&limit=${limit}`),

    /** Health check */
    getHealth: () => api.get('/health'),
};

export default api;
