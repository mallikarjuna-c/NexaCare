import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppNotification, NotificationCategory, NotificationRoute } from '../types/notifications';

const KEY_PREFIX = 'nexacare_notifications_';
const MAX_ITEMS = 100;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToNotifications(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyChanged() {
  listeners.forEach((listener) => listener());
}

function keyFor(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function parseStored(raw: string): AppNotification[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((n): n is AppNotification => !!n && typeof n.id === 'string' && typeof n.title === 'string')
      .filter((n) => n.id !== 'welcome')
      .map((n) => ({ ...n, category: n.category ?? 'announcement' }));
  } catch {
    return null;
  }
}

async function save(userId: string, list: AppNotification[]): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(list.slice(0, MAX_ITEMS)));
  notifyChanged();
}

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  if (raw === null) return [];

  const list = parseStored(raw);
  if (list === null) {
    console.warn('Notification history was unreadable and has been reset.');
    await save(userId, []);
    return [];
  }

  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type NewNotification = {
  title: string;
  body: string;
  category?: NotificationCategory;
  route?: NotificationRoute;
  profileId?: string;
  sourceId?: string;
  createdAt?: string;
};

export async function addNotification(userId: string, input: NewNotification): Promise<AppNotification> {
  const existing = await getNotifications(userId);
  const duplicate = input.sourceId ? existing.find((n) => n.sourceId === input.sourceId) : undefined;
  if (duplicate) return duplicate;

  const created: AppNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title,
    body: input.body,
    createdAt: input.createdAt ?? new Date().toISOString(),
    read: false,
    category: input.category ?? 'announcement',
    route: input.route,
    profileId: input.profileId,
    sourceId: input.sourceId,
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
