import type { Ionicons } from '@expo/vector-icons';

export type ReminderKind = 'medicine' | 'measurement' | 'activity' | 'custom';

export type MealTiming = 'none' | 'before_food' | 'after_food' | 'with_food';

export type MeasurementType = 'blood_pressure' | 'blood_glucose' | 'weight' | 'heart_rate';

export type RepeatRule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'interval'; everyDays: number }
  | { type: 'once' };

export type Reminder = {
  id: string;
  kind: ReminderKind;
  title: string;
  dose?: string;
  mealTiming?: MealTiming;
  measurementType?: MeasurementType;
  times: string[];
  repeat: RepeatRule;
  startDate: string;
  endDate?: string;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReminderInput = Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>;

export type DoseStatus = 'taken' | 'skipped';

export type DoseLog = {
  id: string;
  reminderId: string;
  scheduledAt: string;
  status: DoseStatus;
  at: string;
};

export type OccurrenceState = 'taken' | 'skipped' | 'missed' | 'due' | 'upcoming';

export type Occurrence = {
  key: string;
  reminder: Reminder;
  at: Date;
  state: OccurrenceState;
};

export const KIND_INFO: Record<ReminderKind, { label: string; icon: keyof typeof Ionicons.glyphMap; verb: string }> = {
  medicine: { label: 'Medicine', icon: 'medical-outline', verb: 'Take' },
  measurement: { label: 'Measurement', icon: 'pulse-outline', verb: 'Measure' },
  activity: { label: 'Activity', icon: 'walk-outline', verb: 'Do' },
  custom: { label: 'Other', icon: 'notifications-outline', verb: 'Done' },
};

export const MEAL_LABELS: Record<MealTiming, string> = {
  none: 'Any time',
  before_food: 'Before food',
  after_food: 'After food',
  with_food: 'With food',
};

export const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  blood_pressure: 'Blood pressure',
  blood_glucose: 'Blood sugar',
  weight: 'Weight',
  heart_rate: 'Heart rate',
};

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DUE_WINDOW_MINUTES = 60;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function parseTime(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

export function formatTimeLabel(time: string): string {
  const parsed = parseTime(time);
  if (!parsed) return time;
  return `${parsed.hour % 12 || 12}:${pad(parsed.minute)} ${parsed.hour < 12 ? 'AM' : 'PM'}`;
}

export function formatClock(d: Date): string {
  return `${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export function sortTimes(times: string[]): string[] {
  return [...new Set(times.filter((t) => parseTime(t)))].sort();
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((parseDayKey(toDayKey(b)).getTime() - parseDayKey(toDayKey(a)).getTime()) / 86_400_000);
}

export function occursOnDay(reminder: Reminder, day: Date): boolean {
  const key = toDayKey(day);
  if (key < reminder.startDate) return false;
  if (reminder.endDate && key > reminder.endDate) return false;
  const rule = reminder.repeat;
  switch (rule.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return rule.days.includes(day.getDay());
    case 'interval':
      return daysBetween(parseDayKey(reminder.startDate), day) % Math.max(1, rule.everyDays) === 0;
    case 'once':
      return key === reminder.startDate;
  }
}

export function occurrencesBetween(reminder: Reminder, from: Date, to: Date): Date[] {
  if (!reminder.active || to < from) return [];
  const result: Date[] = [];
  const times = sortTimes(reminder.times).map(parseTime).filter((t): t is { hour: number; minute: number } => !!t);
  const cursor = parseDayKey(toDayKey(from));
  const lastDay = parseDayKey(toDayKey(to));
  while (cursor <= lastDay) {
    if (occursOnDay(reminder, cursor)) {
      for (const t of times) {
        const at = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), t.hour, t.minute);
        if (at >= from && at <= to) result.push(at);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function occurrenceKey(reminderId: string, at: Date): string {
  return `${reminderId}@${toDayKey(at)}T${pad(at.getHours())}${pad(at.getMinutes())}`;
}

export function occurrenceState(at: Date, log: DoseLog | undefined, now: Date): OccurrenceState {
  if (log) return log.status;
  if (at > now) return 'upcoming';
  return now.getTime() - at.getTime() <= DUE_WINDOW_MINUTES * 60_000 ? 'due' : 'missed';
}

export function occurrencesForDay(reminders: Reminder[], logs: DoseLog[], day: Date, now: Date): Occurrence[] {
  const start = parseDayKey(toDayKey(day));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59);
  const byKey = new Map(logs.map((l) => [l.id, l]));
  return reminders
    .flatMap((reminder) =>
      occurrencesBetween(reminder, start, end).map((at) => {
        const key = occurrenceKey(reminder.id, at);
        return { key, reminder, at, state: occurrenceState(at, byKey.get(key), now) };
      })
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime() || a.reminder.title.localeCompare(b.reminder.title));
}

export type Adherence = { taken: number; total: number; percent: number | null };

export function adherenceBetween(reminders: Reminder[], logs: DoseLog[], from: Date, now: Date): Adherence {
  const byKey = new Map(logs.map((l) => [l.id, l]));
  let taken = 0;
  let total = 0;
  for (const reminder of reminders) {
    for (const at of occurrencesBetween(reminder, from, now)) {
      const state = occurrenceState(at, byKey.get(occurrenceKey(reminder.id, at)), now);
      if (state === 'due') continue;
      total++;
      if (state === 'taken') taken++;
    }
  }
  return { taken, total, percent: total ? Math.round((taken / total) * 100) : null };
}

export function repeatSummary(reminder: Pick<Reminder, 'repeat' | 'startDate' | 'endDate'>): string {
  const rule = reminder.repeat;
  let text: string;
  switch (rule.type) {
    case 'daily':
      text = 'Every day';
      break;
    case 'weekdays':
      text = rule.days.length === 7 ? 'Every day' : [...rule.days].sort().map((d) => WEEKDAY_SHORT[d]).join(', ');
      break;
    case 'interval':
      text = rule.everyDays === 1 ? 'Every day' : `Every ${rule.everyDays} days`;
      break;
    case 'once':
      text = 'Once';
      break;
  }
  return reminder.endDate && rule.type !== 'once' ? `${text} · until ${reminder.endDate}` : text;
}

export function reminderDetail(reminder: Pick<Reminder, 'kind' | 'dose' | 'mealTiming' | 'measurementType'>): string {
  const parts: string[] = [];
  if (reminder.kind === 'medicine') {
    if (reminder.dose) parts.push(reminder.dose);
    if (reminder.mealTiming && reminder.mealTiming !== 'none') parts.push(MEAL_LABELS[reminder.mealTiming]);
  }
  if (reminder.kind === 'measurement' && reminder.measurementType) parts.push(MEASUREMENT_LABELS[reminder.measurementType]);
  return parts.join(' · ');
}

export function dayPart(at: Date): 'Morning' | 'Afternoon' | 'Evening' | 'Night' {
  const h = at.getHours();
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  return 'Night';
}

export const TEMPLATES: { kind: ReminderKind; title: string; times: string[]; measurementType?: MeasurementType }[] = [
  { kind: 'medicine', title: 'Take medicine', times: ['08:00'] },
  { kind: 'measurement', title: 'Check blood pressure', times: ['08:00'], measurementType: 'blood_pressure' },
  { kind: 'measurement', title: 'Check blood sugar', times: ['07:30'], measurementType: 'blood_glucose' },
  { kind: 'activity', title: 'Drink water', times: ['10:00', '13:00', '16:00', '19:00'] },
  { kind: 'activity', title: 'Evening walk', times: ['18:30'] },
];
