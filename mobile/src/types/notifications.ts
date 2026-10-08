export type NotificationCategory = 'announcement' | 'reminder' | 'challenge' | 'health';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  category: NotificationCategory;
};

// 'unsupported' = emulator/simulator, which can't receive notifications.
export type NotificationPermissionState = 'granted' | 'undetermined' | 'denied' | 'unsupported';

export type ReminderKey = 'health_checkin' | 'challenge_progress';

export type ReminderDefinition = {
  key: ReminderKey;
  label: string;
  description: string;
  notificationTitle: string;
  notificationBody: string;
  hour: number; // 24h clock
  minute: number;
};

// Single source of truth for reminder copy and times — the screen reads its labels from here too.
export const REMINDERS: ReminderDefinition[] = [
  {
    key: 'health_checkin',
    label: 'Daily health check-in',
    description: 'Log your vitals and health readings',
    notificationTitle: 'Health check-in',
    notificationBody: "Don't forget to log today's health readings.",
    hour: 20,
    minute: 0,
  },
  {
    key: 'challenge_progress',
    label: 'Challenge progress',
    description: 'Update progress on your active challenges',
    notificationTitle: 'Challenge progress',
    notificationBody: "Log today's progress on your active challenges.",
    hour: 18,
    minute: 0,
  },
];

export type ReminderStatus = Record<ReminderKey, boolean>;

export type SetReminderResult =
  | { ok: true }
  | { ok: false; reason: Exclude<NotificationPermissionState, 'granted'> };
