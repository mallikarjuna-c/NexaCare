export type FollowUpType = 'appointment' | 'test' | 'medication' | 'checkup';

export type FollowUpStatus = 'scheduled' | 'completed' | 'cancelled';

export type ReminderOffset = 'none' | 'at_time' | '1h' | '1d';

export type FollowUp = {
  id: string;
  type: FollowUpType;
  title: string;
  scheduledAt: string;
  providerName?: string;
  providerId?: string;
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

export function formatCalendarDate(d: Date): string {
  const base = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function formatRelativeDay(d: Date): string {
  const diffDays = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return formatCalendarDate(d);
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${formatRelativeDay(d)} · ${formatClockTime(d)}`;
}

export function formatAbsolute(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${formatCalendarDate(d)}, ${formatClockTime(d)}`;
}
