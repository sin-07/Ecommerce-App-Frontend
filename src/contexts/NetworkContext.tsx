import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { api, API_BASE_URL } from '../constants/api';

interface NetworkContextType {
  isOnline: boolean;
  isChecking: boolean;
  hasCachedData: boolean;
  setHasCachedData: (hasData: boolean) => void;
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  isChecking: false,
  hasCachedData: false,
  setHasCachedData: () => {},
  checkConnection: async () => true
});

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [hasCachedData, setHasCachedData] = useState<boolean>(false);
  const intervalRef = useRef<any>(null);
  const isCheckingRef = useRef<boolean>(false);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (isCheckingRef.current) return isOnline;
    isCheckingRef.current = true;
    setIsChecking(true);

    try {
      // Light ping to health or categories endpoint with short 3.5s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const healthUrl = `${API_BASE_URL}/health`;
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      }).catch(async () => {
        // Fallback probe
        return fetch(`${API_BASE_URL}/products/categories`, {
          method: 'GET',
          signal: controller.signal
        });
      });

      clearTimeout(timeoutId);
      const online = response.status >= 200 && response.status < 500;
      setIsOnline(online);
      isCheckingRef.current = false;
      setIsChecking(false);
      return online;
    } catch {
      setIsOnline(false);
      isCheckingRef.current = false;
      setIsChecking(false);
      return false;
    }
  }, [isOnline]);

  useEffect(() => {
    checkConnection();

    // Periodic heartbeat check every 25 seconds
    intervalRef.current = setInterval(() => {
      checkConnection();
    }, 25000);

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkConnection();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.remove();
    };
  }, [checkConnection]);

  const value = useMemo(
    () => ({
      isOnline,
      isChecking,
      hasCachedData,
      setHasCachedData,
      checkConnection
    }),
    [isOnline, isChecking, hasCachedData, setHasCachedData, checkConnection]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
};

export const useNetwork = () => useContext(NetworkContext);
