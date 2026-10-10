import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { cancelReminder, getPermissionState, getScheduledReminders, scheduleReminderAt, userScopedId } from './notificationService';
import { getFamilyMembers } from './familyService';
import { getDoseLogs, getReminders, logDose, saveReminder } from './reminderService';
import {
  occurrenceKey,
  occurrencesBetween,
  reminderDetail,
  toDayKey,
  type DoseStatus,
  type Reminder,
} from '../types/reminders';
import type { NotificationPayload } from '../types/notifications';

export const DOSE_CATEGORY = 'nexacare_dose';
export const TASK_CATEGORY = 'nexacare_task';
export const ACTION_TAKEN = 'taken';
export const ACTION_DONE = 'done';
export const ACTION_SKIP = 'skip';
export const ACTION_SNOOZE = 'snooze';

const WINDOW_DAYS = 7;
const SNOOZE_MINUTES = 10;
const KIND_EMOJI: Record<Reminder['kind'], string> = { medicine: '💊', measurement: '📏', activity: '🏃', custom: '🔔' };

let categoriesReady: Promise<void> | null = null;

export function setupReminderCategories(): Promise<void> {
  if (!categoriesReady) {
    categoriesReady = Promise.all([
      Notifications.setNotificationCategoryAsync(DOSE_CATEGORY, [
        { identifier: ACTION_TAKEN, buttonTitle: 'Taken ✓', options: { opensAppToForeground: false } },
        { identifier: ACTION_SNOOZE, buttonTitle: `Snooze ${SNOOZE_MINUTES} min`, options: { opensAppToForeground: false } },
        { identifier: ACTION_SKIP, buttonTitle: 'Skip', options: { opensAppToForeground: false, isDestructive: true } },
      ]),
      Notifications.setNotificationCategoryAsync(TASK_CATEGORY, [
        { identifier: ACTION_DONE, buttonTitle: 'Done ✓', options: { opensAppToForeground: false } },
        { identifier: ACTION_SNOOZE, buttonTitle: `Snooze ${SNOOZE_MINUTES} min`, options: { opensAppToForeground: false } },
      ]),
    ])
      .then(() => undefined)
      .catch((error) => {
        categoriesReady = null;
        throw error;
      });
  }
  return categoriesReady;
}

const identifierFor = (profileId: string, reminderId: string, at: Date) =>
  userScopedId(profileId, `rem_${occurrenceKey(reminderId, at).replace(/[^A-Za-z0-9_-]/g, '_')}`);

function contentFor(reminder: Reminder, personName: string | null) {
  const detail = reminderDetail(reminder);
  const body = [detail, personName ? `for ${personName}` : null].filter(Boolean).join(' · ');
  return {
    title: `${KIND_EMOJI[reminder.kind]} ${reminder.title}`,
    body: body || (reminder.kind === 'medicine' ? 'Time to take your medicine' : 'It’s time'),
    category: reminder.kind === 'medicine' ? DOSE_CATEGORY : TASK_CATEGORY,
  };
}

let running: Promise<void> = Promise.resolve();

export function rescheduleReminders(userId: string): Promise<void> {
  running = running.catch(() => {}).then(() => reschedule(userId));
  return running;
}

async function reschedule(userId: string): Promise<void> {
  await setupReminderCategories().catch(() => {});
  const ownPrefix = `nexacare_${userId}`;
  const scheduled = await getScheduledReminders();
  await Promise.all(
    scheduled
      .filter((r) => r.identifier.startsWith(ownPrefix) && r.identifier.includes('_rem_') && !r.identifier.endsWith('_snz'))
      .map((r) => cancelReminder(r.identifier))
  );
  if ((await getPermissionState()) !== 'granted') return;

  const members = await getFamilyMembers(userId).catch(() => []);
  const people = [{ id: userId, name: null as string | null }, ...members.map((m) => ({ id: m.id, name: m.name }))];
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_DAYS * 86_400_000);

  for (const person of people) {
    const [reminders, logs] = await Promise.all([
      getReminders(person.id).catch(() => [] as Reminder[]),
      getDoseLogs(person.id).catch(() => []),
    ]);
    const logged = new Set(logs.map((l) => l.id));
    for (const reminder of reminders) {
      const content = contentFor(reminder, person.name);
      for (const at of occurrencesBetween(reminder, new Date(now.getTime() + 30_000), until)) {
        if (logged.has(occurrenceKey(reminder.id, at))) continue;
        const data: NotificationPayload = {
          route: { screen: 'Reminders' },
          profileId: person.id,
          category: 'reminder',
          reminderId: reminder.id,
          occurrence: at.toISOString(),
        };
        await scheduleReminderAt(identifierFor(person.id, reminder.id, at), content.title, content.body, at, data, content.category).catch(
          () => {}
        );
      }
    }
  }
}

export async function handleReminderAction(
  userId: string,
  response: Notifications.NotificationResponse
): Promise<boolean> {
  const action = response.actionIdentifier;
  if (![ACTION_TAKEN, ACTION_DONE, ACTION_SKIP, ACTION_SNOOZE].includes(action)) return false;
  const { request } = response.notification;
  const data = request.content.data as NotificationPayload | undefined;
  await Notifications.dismissNotificationAsync(request.identifier).catch(() => {});
  if (!data?.reminderId || !data.profileId || !data.occurrence) return true;

  if (action === ACTION_SNOOZE) {
    const at = new Date(Date.now() + SNOOZE_MINUTES * 60_000);
    await scheduleReminderAt(
      `${request.identifier}_snz`,
      request.content.title ?? 'Reminder',
      request.content.body ?? '',
      at,
      data,
      request.content.categoryIdentifier ?? TASK_CATEGORY
    ).catch(() => {});
    return true;
  }

  const status: DoseStatus = action === ACTION_SKIP ? 'skipped' : 'taken';
  await logDose(data.profileId, data.reminderId, new Date(data.occurrence), status);
  await cancelReminder(`${request.identifier.replace(/_snz$/, '')}_snz`);
  return true;
}

const LEGACY_DAILY = [
  { key: 'health_checkin', title: 'Log today’s health readings', kind: 'custom' as const, time: '20:00' },
  { key: 'challenge_progress', title: 'Update challenge progress', kind: 'activity' as const, time: '18:00' },
];

export async function migrateLegacyDailyReminders(userId: string): Promise<void> {
  const flag = `nexacare_reminders_migrated_${userId}`;
  if (await AsyncStorage.getItem(flag)) return;
  const scheduled = new Set((await getScheduledReminders()).map((r) => r.identifier));
  for (const legacy of LEGACY_DAILY) {
    const identifier = userScopedId(userId, legacy.key);
    if (!scheduled.has(identifier)) continue;
    await saveReminder(userId, {
      kind: legacy.kind,
      title: legacy.title,
      times: [legacy.time],
      repeat: { type: 'daily' },
      startDate: toDayKey(new Date()),
      active: true,
    });
    await cancelReminder(identifier);
  }
  await Promise.all(['health-records-daily', 'challenge-daily'].map(cancelReminder));
  await AsyncStorage.setItem(flag, new Date().toISOString());
}
