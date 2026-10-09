import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cancelReminder,
  getPermissionState,
  getScheduledReminders,
  requestNotificationPermission,
  scheduleReminderAt,
  userScopedId,
} from './notificationService';
import {
  FOLLOW_UP_TYPE_LABELS,
  formatAbsolute,
  reminderTimeFor,
  type FollowUp,
  type FollowUpInput,
  type FollowUpSaveResult,
  type FollowUpStatus,
  type ReminderOutcome,
} from '../types/followUps';

const KEY_PREFIX = 'nexacare_followups_';

function keyFor(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

// Deterministic, so we never need to store it — and user-scoped, so logout clears it.
function reminderIdFor(userId: string, followUpId: string) {
  return userScopedId(userId, `followup_${followUpId}`);
}

async function readAll(userId: string): Promise<FollowUp[]> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FollowUp[]) : [];
  } catch {
    console.warn('Follow-up data was unreadable.');
    return [];
  }
}

async function writeAll(userId: string, list: FollowUp[]): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(list));
}

// Brings the device's scheduled reminder in line with the follow-up.
// promptForPermission is true when the user is actively saving, false for background restores.
async function syncReminder(userId: string, followUp: FollowUp, promptForPermission: boolean): Promise<ReminderOutcome> {
  const identifier = reminderIdFor(userId, followUp.id);
  await cancelReminder(identifier);

  if (followUp.status !== 'scheduled') return 'none';
  const at = reminderTimeFor(followUp.scheduledAt, followUp.reminderOffset);
  if (!at) return 'none';
  if (at.getTime() <= Date.now()) return 'time_passed';

  const permission = promptForPermission ? await requestNotificationPermission() : await getPermissionState();
  if (permission === 'unsupported') return 'unsupported';
  if (permission !== 'granted') return 'permission_needed';

  const title = `${FOLLOW_UP_TYPE_LABELS[followUp.type]} reminder`;
  const body = [followUp.title, formatAbsolute(followUp.scheduledAt), followUp.providerName].filter(Boolean).join(' · ');

  try {
    await scheduleReminderAt(identifier, title, body, at);
    return 'scheduled';
  } catch (error) {
    console.warn('Could not schedule follow-up reminder', error);
    return 'failed';
  }
}

export async function getFollowUps(userId: string): Promise<FollowUp[]> {
  const list = await readAll(userId);
  return list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function getFollowUpById(userId: string, id: string): Promise<FollowUp | null> {
  const list = await readAll(userId);
  return list.find((f) => f.id === id) ?? null;
}

export async function addFollowUp(userId: string, input: FollowUpInput): Promise<FollowUpSaveResult> {
  const now = new Date().toISOString();
  const followUp: FollowUp = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'scheduled',
    createdAt: now,
    updatedAt: now,
  };

  const list = await readAll(userId);
  await writeAll(userId, [...list, followUp]);

  const reminder = await syncReminder(userId, followUp, true);
  return { followUp, reminder };
}

export async function updateFollowUp(userId: string, id: string, input: FollowUpInput): Promise<FollowUpSaveResult> {
  const list = await readAll(userId);
  const existing = list.find((f) => f.id === id);
  if (!existing) throw new Error('Follow-up not found.');

  const followUp: FollowUp = { ...existing, ...input, updatedAt: new Date().toISOString() };
  await writeAll(userId, list.map((f) => (f.id === id ? followUp : f)));

  const reminder = await syncReminder(userId, followUp, true);
  return { followUp, reminder };
}

// Completing or cancelling removes the reminder; reopening restores it (without prompting).
export async function setFollowUpStatus(userId: string, id: string, status: FollowUpStatus): Promise<FollowUp> {
  const list = await readAll(userId);
  const existing = list.find((f) => f.id === id);
  if (!existing) throw new Error('Follow-up not found.');

  const now = new Date().toISOString();
  const followUp: FollowUp = {
    ...existing,
    status,
    completedAt: status === 'completed' ? now : undefined,
    updatedAt: now,
  };
  await writeAll(userId, list.map((f) => (f.id === id ? followUp : f)));
  await syncReminder(userId, followUp, false);
  return followUp;
}

export async function deleteFollowUp(userId: string, id: string): Promise<void> {
  await cancelReminder(reminderIdFor(userId, id));
  const list = await readAll(userId);
  await writeAll(userId, list.filter((f) => f.id !== id));
}

// IDs of follow-ups whose reminder is actually scheduled on this device right now.
export async function getActiveReminderIds(userId: string): Promise<Set<string>> {
  const prefix = reminderIdFor(userId, '');
  const scheduled = await getScheduledReminders();
  return new Set(
    scheduled
      .map((request) => request.identifier)
      .filter((identifier) => identifier.startsWith(prefix))
      .map((identifier) => identifier.slice(prefix.length))
  );
}

// Logout clears reminders from the device; this puts back any that should still exist.
// Never prompts — if permission isn't granted it quietly does nothing.
export async function restoreFollowUpReminders(userId: string): Promise<void> {
  const [list, active] = await Promise.all([readAll(userId), getActiveReminderIds(userId)]);
  await Promise.all(list.filter((f) => !active.has(f.id)).map((f) => syncReminder(userId, f, false)));
}
