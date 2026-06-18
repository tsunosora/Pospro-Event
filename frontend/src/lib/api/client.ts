import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    // All mutating pages are "use client" — only localStorage matters
    let token: string | null = null;
    if (typeof window !== 'undefined') {
        token = localStorage.getItem('token') || sessionStorage.getItem('token');
    }
    if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Auto-logout jika token expired atau tidak valid (401)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (typeof window !== 'undefined' && error?.response?.status === 401) {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            // WAJIB hapus cookie juga. Middleware mengizinkan akses berdasarkan COOKIE `token`,
            // sedangkan API pakai localStorage. Kalau cookie tidak dihapus saat 401, middleware
            // terus memantul /login → / sementara API tetap 401 → loop reload tanpa henti
            // (mis. saat token kedaluwarsa setelah mati listrik / backend restart).
            document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            // Redirect ke login hanya jika bukan sudah di halaman login
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
