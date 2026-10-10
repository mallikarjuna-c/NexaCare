import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getPermissionState } from './notificationService';
import { registerDeviceToken, unregisterDeviceToken } from './communityService';

const TOKEN_KEY = 'nexacare_push_token';

let channelReady: Promise<void> | null = null;

export function ensureCommunityChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelReady) {
    channelReady = Notifications.setNotificationChannelAsync('community', {
      name: 'Blood & help requests',
      description: 'Urgent requests from your community and replies to your requests',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
    })
      .then(() => undefined)
      .catch((error) => {
        channelReady = null;
        throw error;
      });
  }
  return channelReady;
}

async function sendToken(token: string): Promise<void> {
  await registerDeviceToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function registerForPush(): Promise<'registered' | 'no-permission' | 'unavailable'> {
  await ensureCommunityChannel().catch(() => {});
  if ((await getPermissionState()) !== 'granted') return 'no-permission';
  try {
    const { data } = await Notifications.getDevicePushTokenAsync();
    if (typeof data !== 'string' || !data) return 'unavailable';
    await sendToken(data);
    return 'registered';
  } catch {
    return 'unavailable';
  }
}

export function watchPushToken(): () => void {
  const subscription = Notifications.addPushTokenListener(({ data }) => {
    if (typeof data === 'string' && data) sendToken(data).catch(() => {});
  });
  return () => subscription.remove();
}

export async function unregisterPush(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await unregisterDeviceToken(token).catch(() => {});
  await AsyncStorage.removeItem(TOKEN_KEY);
}
