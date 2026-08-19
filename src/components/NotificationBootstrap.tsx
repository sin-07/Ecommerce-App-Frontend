import React, { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { registerPushToken } from '../redux/slices/authSlice';
import { registerForPushNotificationsAsync } from '../services/notificationService';

const isExpoGo = (Constants.appOwnership || (Constants as unknown as { executionEnvironment?: string }).executionEnvironment) === 'expo';

export const NotificationBootstrap: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user, token } = useAppSelector((state) => state.auth);
  const hasRegisteredRef = useRef(false);

  useEffect(() => {
    if (isExpoGo) return;
    if (!user || !token || hasRegisteredRef.current) return;

    hasRegisteredRef.current = true;
    void (async () => {
      const expoPushToken = await registerForPushNotificationsAsync();
      if (expoPushToken) {
        await dispatch(registerPushToken({ expoPushToken })).unwrap();
      }
    })();
  }, [dispatch, token, user]);

  useEffect(() => {
    if (!user) {
      hasRegisteredRef.current = false;
    }
  }, [user]);

  return null;
};
