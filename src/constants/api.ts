import axios from 'axios';

/**
 * AP Enterprises - Centralized API Configuration
 * Production Vercel Backend: https://ecommerce-app-backend-blush.vercel.app/api
 */
export const PRODUCTION_API_URL = 'https://ecommerce-app-backend-blush.vercel.app/api';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.trim().length > 0
    ? process.env.EXPO_PUBLIC_API_URL.trim()
    : PRODUCTION_API_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});
