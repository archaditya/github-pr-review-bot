import axios from 'axios';

/**
 * The only way this app talks to apps/api — never fetch() ad hoc elsewhere, so auth
 * handling (cookie credentials, X-App-Key header, 401 redirect) stays in one place.
 */
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  withCredentials: true, // sends the httpOnly session cookie set by apps/api's auth flow
});

// Attach X-App-Key header if configured in browser storage
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const appKey = localStorage.getItem('prbot_app_key');
    if (appKey) {
      config.headers['X-App-Key'] = appKey;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
