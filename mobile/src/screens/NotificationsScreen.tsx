import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import {
  getNotifications, markAsRead, markAllAsRead, subscribeToNotifications,
} from '../services/notificationHistoryService';
import { collectPresentedNotifications, syncBadge } from '../services/notificationInboxService';
import { getPermissionState } from '../services/notificationService';
import type { AppNotification, NotificationCategory } from '../types/notifications';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Notifications'>;
type IconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_BADGES: Record<NotificationCategory, { icon: IconName; bg: string; tint: string }> = {
  announcement: { icon: 'megaphone-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon },
  reminder: { icon: 'alarm-outline', bg: colors.badge.greenBg, tint: colors.badge.greenIcon },
  challenge: { icon: 'trophy-outline', bg: colors.badge.orangeBg, tint: colors.badge.orangeIcon },
  health: { icon: 'pulse-outline', bg: colors.badge.purpleBg, tint: colors.badge.purpleIcon },
  family: { icon: 'people-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon },
  community: { icon: 'water', bg: '#FCE1E1', tint: colors.danger },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatRelative(iso: string) {
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export default function NotificationsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { profiles, activeProfile, selectProfile } = useFamily();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    try {
      await collectPresentedNotifications(user.id).catch(() => {});
      const [list, permission] = await Promise.all([getNotifications(user.id), getPermissionState()]);
      setNotifications(list);
      setBlocked(permission === 'denied');
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
      return subscribeToNotifications(() => {
        if (user) getNotifications(user.id).then(setNotifications).catch(() => {});
      });
    }, [load, user])
  );

  const refresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const openRoute = (n: AppNotification) => {
    const route = n.route;
    if (!route || route.screen === 'Notifications') return;
    if (n.profileId && n.profileId !== activeProfile?.id && profiles.some((p) => p.id === n.profileId)) {
      selectProfile(n.profileId).catch(() => {});
    }
    if (route.screen === 'Family') navigation.getParent()?.navigate('Family' as never);
    else if (route.screen === 'FollowUpDetail') navigation.navigate('FollowUpDetail', route.params);
    else if (route.screen === 'HelpRequest') navigation.navigate('HelpRequest', route.params);
    else navigation.navigate(route.screen);
  };

  const handleOpen = async (n: AppNotification) => {
    if (!user) return;
    openRoute(n);
    if (n.read) return;
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    await markAsRead(user.id, n.id).catch(() => {});
    await syncBadge(user.id);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
    await markAllAsRead(user.id).catch(() => {});
    await syncBadge(user.id);
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
        <Text style={styles.stateBody}>Couldn’t load notifications.</Text>
        <Pressable onPress={() => { setIsLoading(true); load(); }} hitSlop={8}>
          <Text style={styles.linkText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = notifications.filter((n) => new Date(n.createdAt) >= startOfToday);
  const earlier = notifications.filter((n) => new Date(n.createdAt) < startOfToday);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderItem = (n: AppNotification) => {
    const badge = CATEGORY_BADGES[n.category] ?? CATEGORY_BADGES.announcement;
    const hasRoute = !!n.route && n.route.screen !== 'Notifications';
    return (
      <Pressable
        key={n.id}
        style={({ pressed }) => [styles.item, !n.read && styles.itemUnread, pressed && styles.pressed]}
        onPress={() => handleOpen(n)}
        accessibilityRole="button"
        accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.title}. ${n.body}`}
      >
        <View style={[styles.iconBadge, { backgroundColor: badge.bg }]}>
          <Ionicons name={badge.icon} size={18} color={badge.tint} />
        </View>
        <View style={styles.flexText}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemTitle, !n.read && styles.itemTitleUnread]} numberOfLines={1}>
              {n.title}
            </Text>
            <Text style={styles.itemTime}>{formatRelative(n.createdAt)}</Text>
          </View>
          {!!n.body && <Text style={styles.itemBody}>{n.body}</Text>}
        </View>
        {!n.read ? (
          <View style={styles.unreadDot} />
        ) : (
          hasRoute && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={styles.chevron} />
        )}
      </Pressable>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, notifications.length === 0 && styles.contentEmpty]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} colors={[colors.green]} />}
    >
      {blocked && (
        <Pressable
          style={({ pressed }) => [styles.blockedBanner, pressed && styles.pressed]}
          onPress={() => Linking.openSettings()}
        >
          <Ionicons name="notifications-off-outline" size={18} color={colors.danger} />
          <Text style={styles.blockedText}>Notifications are blocked on this phone. Tap to fix.</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.danger} />
        </Pressable>
      )}

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-outline" size={30} color={colors.green} />
          </View>
          <Text style={styles.stateTitle}>You’re all caught up</Text>
          <Text style={styles.stateBody}>Reminders and updates from your family will show up here.</Text>
        </View>
      ) : (
        <>
          {unreadCount > 0 && (
            <View style={styles.topRow}>
              <Text style={styles.unreadText}>{unreadCount} unread</Text>
              <Pressable hitSlop={8} onPress={handleMarkAllRead}>
                <Text style={styles.linkText}>Mark all as read</Text>
              </Pressable>
            </View>
          )}
          {today.length > 0 && (
            <>
              <Text style={styles.groupLabel}>Today</Text>
              <View style={styles.list}>{today.map(renderItem)}</View>
            </>
          )}
          {earlier.length > 0 && (
            <>
              <Text style={[styles.groupLabel, today.length > 0 && styles.groupSpacing]}>Earlier</Text>
              <View style={styles.list}>{earlier.map(renderItem)}</View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  contentEmpty: { flexGrow: 1 },
  flexText: { flex: 1 },
  pressed: { opacity: 0.7 },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.green },

  blockedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md,
    padding: spacing.md, borderRadius: 14, backgroundColor: '#FCE1E1',
  },
  blockedText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.danger },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  unreadText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  groupLabel: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: spacing.sm },
  groupSpacing: { marginTop: spacing.lg },
  list: { gap: spacing.sm },

  item: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  itemUnread: { backgroundColor: colors.blobLight, borderColor: colors.badge.greenBg },
  iconBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  itemTitleUnread: { fontWeight: '800' },
  itemTime: { fontSize: 11, color: colors.textSecondary },
  itemBody: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.green, marginTop: 6 },
  chevron: { alignSelf: 'center' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.blobLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  stateTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  stateBody: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, lineHeight: 19 },
});
