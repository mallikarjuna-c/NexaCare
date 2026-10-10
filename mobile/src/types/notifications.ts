export type NotificationCategory = 'announcement' | 'reminder' | 'challenge' | 'health' | 'family' | 'community';

export type NotificationRoute =
  | { screen: 'FollowUpDetail'; params: { followUpId: string } }
  | { screen: 'HelpRequest'; params: { requestId: string } }
  | { screen: 'HealthRecords' }
  | { screen: 'Challenges' }
  | { screen: 'Notifications' }
  | { screen: 'Reminders' }
  | { screen: 'Family' };

export type NotificationPayload = {
  route?: NotificationRoute;
  profileId?: string;
  category?: NotificationCategory;
  reminderId?: string;
  occurrence?: string;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  category: NotificationCategory;
  route?: NotificationRoute;
  profileId?: string;
  sourceId?: string;
};

const ROUTE_SCREENS = ['FollowUpDetail', 'HelpRequest', 'HealthRecords', 'Challenges', 'Notifications', 'Reminders', 'Family'];
const CATEGORIES: NotificationCategory[] = ['announcement', 'reminder', 'challenge', 'health', 'family', 'community'];

export function parsePayload(data: unknown): NotificationPayload {
  if (!data || typeof data !== 'object') return {};
  const raw = data as Record<string, unknown>;
  const payload: NotificationPayload = {};
  const route = raw.route as { screen?: unknown; params?: { followUpId?: unknown; requestId?: unknown } } | undefined;
  if (route && typeof route.screen === 'string' && ROUTE_SCREENS.includes(route.screen)) {
    if (route.screen === 'FollowUpDetail') {
      if (typeof route.params?.followUpId === 'string') {
        payload.route = { screen: 'FollowUpDetail', params: { followUpId: route.params.followUpId } };
      }
    } else if (route.screen === 'HelpRequest') {
      if (typeof route.params?.requestId === 'string') {
        payload.route = { screen: 'HelpRequest', params: { requestId: route.params.requestId } };
      }
    } else {
      payload.route = { screen: route.screen } as NotificationRoute;
    }
  }
  if (typeof raw.profileId === 'string') payload.profileId = raw.profileId;
  if (typeof raw.reminderId === 'string') payload.reminderId = raw.reminderId;
  if (typeof raw.occurrence === 'string' && !Number.isNaN(Date.parse(raw.occurrence))) payload.occurrence = raw.occurrence;
  if (typeof raw.category === 'string' && CATEGORIES.includes(raw.category as NotificationCategory)) {
    payload.category = raw.category as NotificationCategory;
  }
  return payload;
}

export type NotificationPermissionState = 'granted' | 'undetermined' | 'denied' | 'unsupported';
