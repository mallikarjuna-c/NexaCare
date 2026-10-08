import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  REMINDERS,
  type NotificationPermissionState,
  type ReminderKey,
  type ReminderStatus,
  type SetReminderResult,
} from '../types/notifications';

const ANDROID_CHANNEL_ID = 'reminders';

// Identifiers used before reminders were scoped per user. Cancelled when seen so they
// can't keep firing for whichever account happens to be signed in.
const LEGACY_REMINDER_IDS = ['health-records-daily', 'challenge-daily'];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady: Promise<void> | null = null;

// Android 13+ only shows the permission prompt once a channel exists, so this runs
// before any permission request or schedule call. Safe to call repeatedly.
function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelReady) {
    channelReady = Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Reminders',
      description: 'Daily health and challenge reminders',
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

// Scheduled notifications belong to the device, not the account, so every identifier
// carries the user ID. That keeps one user's reminders out of another user's view.
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

export async function scheduleDailyReminder(
  identifier: string,
  title: string,
  body: string,
  hour: number,
  minute: number
): Promise<string> {
  await ensureAndroidChannel();
  await cancelReminder(identifier); // replace, never duplicate
  return Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
}

// One-off reminder at an exact date/time (used by the Follow-up Tracker next).
export async function scheduleReminderAt(identifier: string, title: string, body: string, date: Date): Promise<string> {
  if (date.getTime() <= Date.now()) {
    throw new Error('Reminder time must be in the future.');
  }
  await ensureAndroidChannel();
  await cancelReminder(identifier);
  return Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
}

export async function scheduleOneTimeReminder(title: string, body: string, secondsFromNow: number): Promise<string> {
  await ensureAndroidChannel();
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsFromNow,
      repeats: false,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
}

export async function cancelReminder(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Nothing scheduled under this identifier — already in the state we want.
  }
}

export async function getScheduledReminders() {
  return Notifications.getAllScheduledNotificationsAsync();
}

// Reads what is actually scheduled on the device, so the UI can never drift from reality.
export async function getReminderStatus(userId: string): Promise<ReminderStatus> {
  const scheduled = await getScheduledReminders();
  const ids = new Set(scheduled.map((request) => request.identifier));

  await Promise.all(LEGACY_REMINDER_IDS.filter((id) => ids.has(id)).map(cancelReminder));

  const status = {} as ReminderStatus;
  for (const reminder of REMINDERS) {
    status[reminder.key] = ids.has(userScopedId(userId, reminder.key));
  }
  return status;
}

export async function setReminderEnabled(userId: string, key: ReminderKey, enabled: boolean): Promise<SetReminderResult> {
  const identifier = userScopedId(userId, key);

  // Turning a reminder off never needs permission.
  if (!enabled) {
    await cancelReminder(identifier);
    return { ok: true };
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return { ok: false, reason: permission };

  const reminder = REMINDERS.find((r) => r.key === key);
  if (!reminder) throw new Error(`Unknown reminder: ${key}`);

  await scheduleDailyReminder(identifier, reminder.notificationTitle, reminder.notificationBody, reminder.hour, reminder.minute);
  return { ok: true };
}

// Called on logout so a signed-out user's reminders don't fire for the next person.
export async function cancelAllRemindersForUser(userId: string): Promise<void> {
  const prefix = userScopedId(userId, '');
  const scheduled = await getScheduledReminders();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(prefix))
      .map((request) => cancelReminder(request.identifier))
  );
}
