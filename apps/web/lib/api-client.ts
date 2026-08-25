import axios from 'axios';

/**
 * The only way this app talks to apps/api — never fetch() ad hoc elsewhere, so auth
 * handling (cookie credentials, 401 redirect) stays in one place.
 */
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  withCredentials: true, // sends the httpOnly session cookie set by apps/api's auth flow
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
