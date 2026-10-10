import { loadData, removeLocalData, saveData } from './profileStore';
import { occurrenceKey, sortTimes, type DoseLog, type DoseStatus, type Reminder, type ReminderInput } from '../types/reminders';

const LOG_RETENTION_DAYS = 90;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToReminders(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function changed() {
  listeners.forEach((listener) => listener());
}

export async function getReminders(profileId: string): Promise<Reminder[]> {
  const list = await loadData<Reminder[]>('reminders', profileId, []);
  return (Array.isArray(list) ? list : []).sort((a, b) => a.title.localeCompare(b.title));
}

export async function getReminder(profileId: string, id: string): Promise<Reminder | null> {
  return (await getReminders(profileId)).find((r) => r.id === id) ?? null;
}

function clean(input: ReminderInput): ReminderInput {
  return {
    ...input,
    title: input.title.trim(),
    dose: input.kind === 'medicine' ? input.dose?.trim() || undefined : undefined,
    mealTiming: input.kind === 'medicine' ? input.mealTiming : undefined,
    measurementType: input.kind === 'measurement' ? input.measurementType : undefined,
    notes: input.notes?.trim() || undefined,
    times: sortTimes(input.times),
    endDate: input.repeat.type === 'once' ? undefined : input.endDate,
  };
}

export async function saveReminder(profileId: string, input: ReminderInput, id?: string): Promise<Reminder> {
  const list = await getReminders(profileId);
  const now = new Date().toISOString();
  const existing = id ? list.find((r) => r.id === id) : undefined;
  const reminder: Reminder = existing
    ? { ...existing, ...clean(input), updatedAt: now }
    : { ...clean(input), id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`, createdAt: now, updatedAt: now };
  await saveData('reminders', profileId, existing ? list.map((r) => (r.id === id ? reminder : r)) : [...list, reminder]);
  changed();
  return reminder;
}

export async function setReminderActive(profileId: string, id: string, active: boolean): Promise<void> {
  const list = await getReminders(profileId);
  await saveData(
    'reminders',
    profileId,
    list.map((r) => (r.id === id ? { ...r, active, updatedAt: new Date().toISOString() } : r))
  );
  changed();
}

export async function deleteReminder(profileId: string, id: string): Promise<void> {
  const [list, logs] = await Promise.all([getReminders(profileId), getDoseLogs(profileId)]);
  await saveData('reminders', profileId, list.filter((r) => r.id !== id));
  await saveData('reminder_logs', profileId, logs.filter((l) => l.reminderId !== id));
  changed();
}

export async function getDoseLogs(profileId: string): Promise<DoseLog[]> {
  const list = await loadData<DoseLog[]>('reminder_logs', profileId, []);
  return Array.isArray(list) ? list : [];
}

export async function logDose(profileId: string, reminderId: string, scheduledAt: Date, status: DoseStatus): Promise<DoseLog> {
  const logs = await getDoseLogs(profileId);
  const id = occurrenceKey(reminderId, scheduledAt);
  const entry: DoseLog = { id, reminderId, scheduledAt: scheduledAt.toISOString(), status, at: new Date().toISOString() };
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 86_400_000;
  const kept = logs.filter((l) => l.id !== id && new Date(l.scheduledAt).getTime() >= cutoff);
  await saveData('reminder_logs', profileId, [...kept, entry]);
  changed();
  return entry;
}

export async function undoDose(profileId: string, reminderId: string, scheduledAt: Date): Promise<void> {
  const id = occurrenceKey(reminderId, scheduledAt);
  const logs = await getDoseLogs(profileId);
  await saveData('reminder_logs', profileId, logs.filter((l) => l.id !== id));
  changed();
}

export async function removeAllReminders(profileId: string): Promise<void> {
  await Promise.all([removeLocalData('reminders', profileId), removeLocalData('reminder_logs', profileId)]);
}
