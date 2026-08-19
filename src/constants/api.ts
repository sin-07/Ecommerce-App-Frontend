import axios from 'axios';
import Constants from 'expo-constants';

const getExpoHostIp = () => {
  const hostUri =
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ||
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost ||
    '';

  if (!hostUri) return null;
  return hostUri.split(':')[0] || null;
};

const buildFallbackApiUrl = () => {
  const hostIp = getExpoHostIp();
  if (hostIp) {
    return `http://${hostIp}:5000/api`;
  }

  return 'http://localhost:5000/api';
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || buildFallbackApiUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
});
