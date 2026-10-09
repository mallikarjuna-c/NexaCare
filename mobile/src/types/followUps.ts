export type FollowUpType = 'appointment' | 'test' | 'medication' | 'checkup';

// 'overdue' is not stored — it's derived from scheduledAt (see isOverdue).
export type FollowUpStatus = 'scheduled' | 'completed' | 'cancelled';

export type ReminderOffset = 'none' | 'at_time' | '1h' | '1d';

export type FollowUp = {
  id: string;
  type: FollowUpType;
  title: string;
  scheduledAt: string; // ISO date-time
  providerName?: string; // doctor / clinic / lab — kept even if the linked provider is removed
  providerId?: string; // link to a saved provider in the Healthcare Directory
  location?: string;
  notes?: string;
  reminderOffset: ReminderOffset;
  status: FollowUpStatus;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type FollowUpInput = Pick<
  FollowUp,
  'type' | 'title' | 'scheduledAt' | 'providerName' | 'providerId' | 'location' | 'notes' | 'reminderOffset'
>;

// What happened when we tried to set the reminder, so the UI can tell the user honestly.
export type ReminderOutcome = 'scheduled' | 'none' | 'time_passed' | 'permission_needed' | 'unsupported' | 'failed';

export type FollowUpSaveResult = { followUp: FollowUp; reminder: ReminderOutcome };

export const FOLLOW_UP_TYPE_LABELS: Record<FollowUpType, string> = {
  appointment: 'Appointment',
  test: 'Prescribed Test',
  medication: 'Medication Follow-up',
  checkup: 'Checkup',
};

export const FOLLOW_UP_TYPES = Object.keys(FOLLOW_UP_TYPE_LABELS) as FollowUpType[];

export const REMINDER_OFFSET_LABELS: Record<ReminderOffset, string> = {
  none: 'No reminder',
  at_time: 'At time',
  '1h': '1 hour before',
  '1d': '1 day before',
};

export const REMINDER_OFFSETS = Object.keys(REMINDER_OFFSET_LABELS) as ReminderOffset[];

const REMINDER_OFFSET_MINUTES: Record<Exclude<ReminderOffset, 'none'>, number> = {
  at_time: 0,
  '1h': 60,
  '1d': 24 * 60,
};

export function reminderTimeFor(scheduledAt: string, offset: ReminderOffset): Date | null {
  if (offset === 'none') return null;
  return new Date(new Date(scheduledAt).getTime() - REMINDER_OFFSET_MINUTES[offset] * 60_000);
}

export function isOverdue(followUp: FollowUp, now = Date.now()): boolean {
  return followUp.status === 'scheduled' && new Date(followUp.scheduledAt).getTime() < now;
}

// ---- Date formatting (manual, so output is identical on every device/locale) ----

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatClockTime(d: Date): string {
  const hour = d.getHours();
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(d.getMinutes()).padStart(2, '0')} ${period}`;
}

// "Mon, 5 Oct" (adds the year when it isn't the current year)
export function formatCalendarDate(d: Date): string {
  const base = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

// "Today", "Tomorrow", "Yesterday", or a calendar date
export function formatRelativeDay(d: Date): string {
  const diffDays = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return formatCalendarDate(d);
}

// For on-screen labels: "Tomorrow · 10:30 AM"
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${formatRelativeDay(d)} · ${formatClockTime(d)}`;
}

// For text that's read later (e.g. notification bodies), where "Tomorrow" would go stale.
export function formatAbsolute(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${formatCalendarDate(d)}, ${formatClockTime(d)}`;
}
