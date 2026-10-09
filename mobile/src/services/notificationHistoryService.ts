import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppNotification, NotificationCategory } from '../types/notifications';

const KEY_PREFIX = 'nexacare_notifications_';
const MAX_ITEMS = 100;

function keyFor(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function welcomeNotification(): AppNotification {
  return {
    id: 'welcome',
    title: 'Welcome to NexaCare',
    body: 'Track your health records, join community challenges and set reminders — all in one place.',
    createdAt: new Date().toISOString(),
    read: false,
    category: 'announcement',
  };
}

// Returns null when stored data is unreadable, so the caller can recover instead of crashing.
function parseStored(raw: string): AppNotification[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((n): n is AppNotification => !!n && typeof n.id === 'string' && typeof n.title === 'string')
      .map((n) => ({ ...n, category: n.category ?? 'announcement' })); // older entries had no category
  } catch {
    return null;
  }
}

async function save(userId: string, list: AppNotification[]): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(list.slice(0, MAX_ITEMS)));
}

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const raw = await AsyncStorage.getItem(keyFor(userId));

  // First run: a real welcome message, so the inbox isn't empty.
  if (raw === null) {
    const seeded = [welcomeNotification()];
    await save(userId, seeded);
    return seeded;
  }

  const list = parseStored(raw);
  if (list === null) {
    console.warn('Notification history was unreadable and has been reset.');
    await save(userId, []);
    return [];
  }

  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addNotification(
  userId: string,
  title: string,
  body: string,
  category: NotificationCategory = 'announcement'
): Promise<AppNotification> {
  const existing = await getNotifications(userId);
  const created: AppNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
    category,
  };
  await save(userId, [created, ...existing]);
  return created;
}

export async function markAsRead(userId: string, id: string): Promise<void> {
  const existing = await getNotifications(userId);
  await save(userId, existing.map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export async function markAllAsRead(userId: string): Promise<void> {
  const existing = await getNotifications(userId);
  await save(userId, existing.map((n) => ({ ...n, read: true })));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const existing = await getNotifications(userId);
  return existing.filter((n) => !n.read).length;
}
