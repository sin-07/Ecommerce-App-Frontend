import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toast } from '../utils/toast';

/**
 * AP Enterprises - Centralized API Configuration & Resilient Interceptors
 * Production Vercel Backend: https://ecommerce-app-backend-blush.vercel.app/api
 */
export const PRODUCTION_API_URL = 'https://ecommerce-app-backend-blush.vercel.app/api';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.trim().length > 0
    ? process.env.EXPO_PUBLIC_API_URL.trim()
    : PRODUCTION_API_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15-second sensible timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach bearer token if available
api.interceptors.request.use(
  async (config) => {
    if (!config.headers.Authorization) {
      try {
        const raw = await AsyncStorage.getItem('auth_session');
        if (raw) {
          const session = JSON.parse(raw);
          if (session?.token) {
            config.headers.Authorization = `Bearer ${session.token}`;
          }
        }
      } catch {
        // Storage read fallback
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Expiration, Timeouts, Network Drops
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      // Clear invalid/expired session
      try {
        await AsyncStorage.removeItem('auth_session');
        delete api.defaults.headers.common.Authorization;
      } catch {
        // Safe cleanup
      }
      toast.show('Your session has expired. Please sign in again.', 'warning', 'Session Expired');
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      const timeoutErr = new Error('Request timed out. Please try again.');
      return Promise.reject(timeoutErr);
    } else if (!error.response && error.message === 'Network Error') {
      const netErr = new Error('No internet connection. Please reconnect and try again.');
      return Promise.reject(netErr);
    }

    return Promise.reject(error);
  }
);
