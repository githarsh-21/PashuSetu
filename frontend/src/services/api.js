import axios from 'axios';

// Use relative URL in development to let Vite's proxy forward /api to FastAPI.
// Falls back to an environment variable in production or local 8000.
const baseURL = import.meta.env.VITE_API_URL || '/api';

const API = axios.create({
    baseURL,
    timeout: 90000, // 30-second timeout for ML inference and image uploads
});

// Request Interceptor: Attach authentication token or headers if needed
API.interceptors.request.use(
    (config) => {
        // Retrieve persisted token/user credentials if stored in localStorage
        const user = localStorage.getItem('pashusetu_user');
        if (user) {
            try {
                const parsed = JSON.parse(user);
                if (parsed.token) {
                    config.headers.Authorization = `Bearer ${parsed.token}`;
                }
            } catch (e) {
                console.error('Failed to parse auth token:', e);
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Friendly handling for offline drops and server timeouts
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (!navigator.onLine) {
            console.warn('Network request failed: Device is offline.');
        }
        return Promise.reject(error);
    }
);

export default API;