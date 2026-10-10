import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { parsePayload, type NotificationPayload, type NotificationPermissionState } from '../types/notifications';

const ANDROID_CHANNEL_ID = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady: Promise<void> | null = null;

function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelReady) {
    channelReady = Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Reminders',
      description: 'Medicine, check-up, appointment and habit reminders',
      importance: Notifications.AndroidImportance.HIGH,
    })
      .then(() => undefined)
      .catch((error) => {
        channelReady = null;
        throw error;
      });
  }
  return channelReady;
}

function toPermissionState(response: Notifications.NotificationPermissionsStatus): NotificationPermissionState {
  if (response.granted) return 'granted';
  if (response.status === 'denied' && !response.canAskAgain) return 'denied';
  return 'undetermined';
}

export function userScopedId(userId: string, suffix: string): string {
  return `nexacare_${userId}_${suffix}`;
}

export async function getPermissionState(): Promise<NotificationPermissionState> {
  if (!Device.isDevice) return 'unsupported';
  return toPermissionState(await Notifications.getPermissionsAsync());
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!Device.isDevice) return 'unsupported';
  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return toPermissionState(current);

  return toPermissionState(await Notifications.requestPermissionsAsync());
}

export async function scheduleReminderAt(
  identifier: string,
  title: string,
  body: string,
  date: Date,
  data?: NotificationPayload,
  categoryIdentifier?: string
): Promise<string> {
  if (date.getTime() <= Date.now()) {
    throw new Error('Reminder time must be in the future.');
  }
  await ensureAndroidChannel();
  await cancelReminder(identifier);
  return Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, data: data ?? {}, ...(categoryIdentifier ? { categoryIdentifier } : {}) },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
}

export async function cancelReminder(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
  }
}

export async function getScheduledReminders() {
  return Notifications.getAllScheduledNotificationsAsync();
}

export type UpcomingReminder = {
  identifier: string;
  title: string;
  body: string;
  at: Date;
  repeatsDaily: boolean;
  payload: NotificationPayload;
};

function nextFireTime(trigger: unknown, now = new Date()): { at: Date; repeatsDaily: boolean } | null {
  if (!trigger || typeof trigger !== 'object') return null;
  const t = trigger as Record<string, unknown>;
  if (t.type === 'daily' && typeof t.hour === 'number' && typeof t.minute === 'number') {
    const at = new Date(now);
    at.setHours(t.hour, t.minute, 0, 0);
    if (at <= now) at.setDate(at.getDate() + 1);
    return { at, repeatsDaily: true };
  }
  const raw = typeof t.value === 'number' ? t.value : t.date instanceof Date ? t.date.getTime() : typeof t.date === 'number' ? t.date : null;
  if (raw == null) return null;
  const at = new Date(raw);
  return at > now ? { at, repeatsDaily: false } : null;
}

export async function getUpcomingReminders(userId: string): Promise<UpcomingReminder[]> {
  const prefix = userScopedId(userId, '');
  const scheduled = await getScheduledReminders();
  return scheduled
    .filter((request) => request.identifier.startsWith(prefix))
    .flatMap((request) => {
      const next = nextFireTime(request.trigger);
      if (!next) return [];
      return [{
        identifier: request.identifier,
        title: request.content.title ?? 'Reminder',
        body: request.content.body ?? '',
        at: next.at,
        repeatsDaily: next.repeatsDaily,
        payload: parsePayload(request.content.data),
      }];
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export async function cancelAllRemindersForUser(userId: string): Promise<void> {
  const prefix = userScopedId(userId, '');
  const scheduled = await getScheduledReminders();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(prefix))
      .map((request) => cancelReminder(request.identifier))
  );
}
