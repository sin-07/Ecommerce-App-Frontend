import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsModule from 'expo-notifications';

const isExpoGo =
  (Constants.appOwnership ||
    (Constants as unknown as { executionEnvironment?: string }).executionEnvironment) === 'expo';

let notifications: typeof NotificationsModule | null | undefined;

/**
 * Safely loads the expo-notifications module without throwing fatal errors on Android.
 */
const getNotifications = (): typeof NotificationsModule | null => {
  if (isExpoGo) return null;

  if (notifications === undefined) {
    try {
      notifications = require('expo-notifications') as typeof NotificationsModule;
      if (notifications && notifications.setNotificationHandler) {
        notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false
          })
        });
      }
    } catch (err: any) {
      console.warn('[Notifications] Initialization skipped:', err?.message || err);
      notifications = null;
    }
  }

  return notifications;
};

export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return null;

    if (!Device.isDevice) {
      return null;
    }

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0F172A'
        });
      } catch (channelErr: any) {
        console.warn('[Notifications] Android channel setup warning:', channelErr?.message);
      }
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId =
      (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas
        ?.projectId ||
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId ||
      'dc96537a-5ea1-4e75-8dc8-8247a0a103a2';

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token?.data || null;
  } catch (error: any) {
    console.warn('[Push Token] Registration skipped safely:', error?.message || error);
    return null;
  }
};

export const sendLocalNotification = async (
  title: string,
  body: string,
  data: Record<string, string> = {}
) => {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return;

    await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: null
    });
  } catch (error: any) {
    console.warn('[Local Notification] Skipped safely:', error?.message || error);
  }
};
