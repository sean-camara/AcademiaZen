import axios from 'axios';

// Ensure this matches your backend port (usually 5000)
const BASE_URL = 'http://localhost:5000';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// 1. REQUEST INTERCEPTOR: Attaches Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 2. RESPONSE INTERCEPTOR: Handles 401 (Logout)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // If network error (backend down), don't logout, just reject
        if (!error.response) {
            console.error("Network Error: Is the backend running?");
            return Promise.reject(error);
        }

        if (error.response.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            // Optional: window.location.href = '/login'; 
        }
        return Promise.reject(error);
    }
);

export default api;