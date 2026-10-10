import * as Notifications from 'expo-notifications';
import { addNotification, getUnreadCount, markAsRead } from './notificationHistoryService';
import { parsePayload, type AppNotification, type NotificationPayload } from '../types/notifications';

function sourceIdOf(notification: Notifications.Notification): string {
  return `${notification.request.identifier}@${Math.round(notification.date)}`;
}

export async function recordNotification(
  userId: string,
  notification: Notifications.Notification
): Promise<{ item: AppNotification; payload: NotificationPayload }> {
  const { title, body, data } = notification.request.content;
  const payload = parsePayload(data);
  const item = await addNotification(userId, {
    title: title ?? 'NexaCare',
    body: body ?? '',
    category: payload.category ?? 'reminder',
    route: payload.route,
    profileId: payload.profileId,
    sourceId: sourceIdOf(notification),
    createdAt: new Date(notification.date).toISOString(),
  });
  return { item, payload };
}

export async function recordOpenedNotification(
  userId: string,
  response: Notifications.NotificationResponse
): Promise<NotificationPayload> {
  const { item, payload } = await recordNotification(userId, response.notification);
  await markAsRead(userId, item.id);
  return payload;
}

export async function collectPresentedNotifications(userId: string): Promise<void> {
  const presented = await Notifications.getPresentedNotificationsAsync();
  for (const notification of presented) await recordNotification(userId, notification);
}

export async function syncBadge(userId: string): Promise<void> {
  await Notifications.setBadgeCountAsync(await getUnreadCount(userId)).catch(() => false);
}
