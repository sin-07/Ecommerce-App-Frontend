import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsModule from 'expo-notifications';

const isExpoGo = (Constants.appOwnership || (Constants as unknown as { executionEnvironment?: string }).executionEnvironment) === 'expo';

let notifications: typeof NotificationsModule | null | undefined;

/**
 * Expo Go for Android no longer contains the native remote-notifications
 * implementation. Loading the package there produces a warning, so defer the
 * native module until we are running in a development or production build.
 */
const getNotifications = (): typeof NotificationsModule | null => {
  if (isExpoGo) return null;

  if (notifications === undefined) {
    notifications = require('expo-notifications') as typeof NotificationsModule;
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

  return notifications;
};

export const registerForPushNotificationsAsync = async () => {
  const Notifications = getNotifications();
  if (!Notifications) return null;

  if (!Device.isDevice) {
    return null;
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
    (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas?.projectId ||
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return token.data;
};

export const sendLocalNotification = async (title: string, body: string, data: Record<string, string> = {}) => {
  const Notifications = getNotifications();
  if (!Notifications) return;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: null
  });
};
