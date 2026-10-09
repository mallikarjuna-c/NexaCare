import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Switch, ActivityIndicator, Alert, AppState, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import LeafAccent from '../components/LeafAccent';
import { getNotifications, markAsRead, markAllAsRead } from '../services/notificationHistoryService';
import {
  getPermissionState, getReminderStatus, requestNotificationPermission, setReminderEnabled,
} from '../services/notificationService';
import {
  REMINDERS,
  type AppNotification,
  type NotificationCategory,
  type NotificationPermissionState,
  type ReminderKey,
  type ReminderStatus,
} from '../types/notifications';
import { colors, spacing } from '../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type BadgeStyle = { icon: IconName; bg: string; tint: string };

const DANGER_TINT = '#FCE1E1';

const REMINDER_BADGES: Record<ReminderKey, BadgeStyle> = {
  health_checkin: { icon: 'heart-outline', bg: colors.badge.greenBg, tint: colors.badge.greenIcon },
  challenge_progress: { icon: 'trophy-outline', bg: colors.badge.orangeBg, tint: colors.badge.orangeIcon },
};

const CATEGORY_BADGES: Record<NotificationCategory, BadgeStyle> = {
  announcement: { icon: 'megaphone-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon },
  reminder: { icon: 'alarm-outline', bg: colors.badge.greenBg, tint: colors.badge.greenIcon },
  challenge: { icon: 'trophy-outline', bg: colors.badge.orangeBg, tint: colors.badge.orangeIcon },
  health: { icon: 'pulse-outline', bg: colors.badge.purpleBg, tint: colors.badge.purpleIcon },
};

const ALL_OFF: ReminderStatus = { health_checkin: false, challenge_progress: false };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTime(hour: number, minute: number) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

function nextOccurrenceDay(hour: number, minute: number) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(hour, minute, 0, 0);
  return today > now ? 'Today' : 'Tomorrow';
}

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

type BannerProps = {
  permission: NotificationPermissionState | null;
  anyReminderOn: boolean;
  onAction: () => void;
};

function PermissionBanner({ permission, anyReminderOn, onAction }: BannerProps) {
  if (permission === null || permission === 'granted') return null;

  const config = {
    denied: {
      icon: 'notifications-off-outline' as IconName,
      bg: DANGER_TINT,
      tint: colors.danger,
      title: 'Notifications are blocked',
      body: anyReminderOn
        ? "Your reminders are scheduled but won't appear until you allow notifications for NexaCare."
        : 'Allow notifications for NexaCare in your device settings to receive reminders.',
      action: 'Open Settings',
    },
    undetermined: {
      icon: 'notifications-outline' as IconName,
      bg: colors.badge.blueBg,
      tint: colors.badge.blueIcon,
      title: 'Turn on notifications',
      body: 'Get gentle reminders to log your health and keep up with your challenges.',
      action: 'Allow',
    },
    unsupported: {
      icon: 'phone-portrait-outline' as IconName,
      bg: colors.blobLight,
      tint: colors.textSecondary,
      title: 'Reminders need a physical device',
      body: "Notifications can't be delivered on an emulator or simulator.",
      action: null,
    },
  }[permission];

  return (
    <View style={[styles.banner, permission === 'denied' && styles.bannerDanger]}>
      <View style={styles.bannerTop}>
        <View style={[styles.iconBadge, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={20} color={config.tint} />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.rowTitle}>{config.title}</Text>
          <Text style={styles.rowSubtitle}>{config.body}</Text>
        </View>
      </View>
      {config.action && (
        <Pressable
          style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
          onPress={onAction}
          accessibilityRole="button"
        >
          <Text style={styles.pillButtonText}>{config.action}</Text>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [reminders, setReminders] = useState<ReminderStatus>(ALL_OFF);
  const [permission, setPermission] = useState<NotificationPermissionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<ReminderKey | null>(null);

  const syncDeviceState = useCallback(async () => {
    if (!user) return;
    const [perm, status] = await Promise.all([getPermissionState(), getReminderStatus(user.id)]);
    setPermission(perm);
    setReminders(status);
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    try {
      const [list] = await Promise.all([getNotifications(user.id), syncDeviceState()]);
      setNotifications(list);
    } catch {
      setLoadError("We couldn't load your notifications. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [user, syncDeviceState]);

  useFocusEffect(
    useCallback(() => {
      load();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') syncDeviceState().catch(() => {});
      });
      return () => subscription.remove();
    }, [load, syncDeviceState])
  );

  const handleToggle = async (key: ReminderKey, value: boolean) => {
    if (!user || busyKey) return;
    setBusyKey(key);
    try {
      const result = await setReminderEnabled(user.id, key, value);
      if (!result.ok) {
        setPermission(result.reason);
        if (result.reason === 'denied') {
          Alert.alert(
            'Notifications are blocked',
            'Allow notifications for NexaCare in your device settings to receive reminders.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        } else if (result.reason === 'unsupported') {
          Alert.alert('Not available', "Reminders need a physical device. They can't be delivered on an emulator.");
        }
      }
    } catch {
      Alert.alert(
        'Something went wrong',
        value ? "We couldn't schedule this reminder. Please try again." : "We couldn't turn off this reminder. Please try again."
      );
    } finally {
      await syncDeviceState().catch(() => {});
      setBusyKey(null);
    }
  };

  const handleBannerAction = async () => {
    if (permission === 'denied') {
      Linking.openSettings();
      return;
    }
    try {
      setPermission(await requestNotificationPermission());
    } catch {
      Alert.alert('Something went wrong', "We couldn't request notification permission. Please try again.");
    }
  };

  const handleOpenNotification = async (n: AppNotification) => {
    if (!user || n.read) return;
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    try {
      await markAsRead(user.id, n.id);
    } catch {
      load();
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
    try {
      await markAllAsRead(user.id);
    } catch {
      load();
    }
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
        <View style={[styles.iconBadgeLarge, { backgroundColor: DANGER_TINT }]}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
        </View>
        <Text style={styles.stateTitle}>Couldn't load notifications</Text>
        <Text style={styles.stateBody}>{loadError}</Text>
        <Pressable
          style={({ pressed }) => [styles.pillButton, styles.retryButton, pressed && styles.pressed]}
          onPress={() => { setIsLoading(true); load(); }}
        >
          <Text style={styles.pillButtonText}>Try again</Text>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const anyReminderOn = REMINDERS.some((r) => reminders[r.key]);

  return (
    <View style={styles.screen}>
      <View style={[styles.leafWrap, styles.leafBottomRight]} pointerEvents="none">
        <LeafAccent size={180} color={colors.green} rotation={160} opacity={0.08} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PermissionBanner permission={permission} anyReminderOn={anyReminderOn} onAction={handleBannerAction} />

        <Text style={styles.sectionLabel}>Reminders</Text>
        <Text style={styles.sectionHint}>Daily nudges delivered to this device.</Text>
        <View style={styles.card}>
          {REMINDERS.map((r, index) => {
            const on = reminders[r.key];
            const badge = REMINDER_BADGES[r.key];
            const time = formatTime(r.hour, r.minute);
            return (
              <View key={r.key}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.reminderRow}>
                  <View style={[styles.iconBadge, { backgroundColor: badge.bg }]}>
                    <Ionicons name={badge.icon} size={20} color={badge.tint} />
                  </View>
                  <View style={styles.flexText}>
                    <Text style={styles.rowTitle}>{r.label}</Text>
                    <Text style={styles.rowSubtitle}>{r.description}</Text>
                    <View style={[styles.timeChip, on && styles.timeChipOn]}>
                      <Ionicons name="time-outline" size={12} color={on ? colors.green : colors.textSecondary} />
                      <Text style={[styles.timeChipText, on && styles.timeChipTextOn]}>
                        {on ? `Next: ${nextOccurrenceDay(r.hour, r.minute)}, ${time}` : `Daily at ${time}`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.switchSlot}>
                    {busyKey === r.key ? (
                      <ActivityIndicator size="small" color={colors.green} />
                    ) : (
                      <Switch
                        value={on}
                        onValueChange={(value) => handleToggle(r.key, value)}
                        disabled={busyKey !== null}
                        trackColor={{ true: colors.green, false: colors.border }}
                        thumbColor={colors.surface}
                        accessibilityLabel={r.label}
                      />
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>Inbox</Text>
            {unreadCount > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{unreadCount} new</Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <Pressable hitSlop={8} onPress={handleMarkAllRead}>
              <Text style={styles.linkText}>Mark all as read</Text>
            </Pressable>
          )}
        </View>

        {notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={[styles.iconBadgeLarge, { backgroundColor: colors.badge.greenBg }]}>
              <Ionicons name="checkmark-done-outline" size={26} color={colors.badge.greenIcon} />
            </View>
            <Text style={styles.stateTitle}>You're all caught up</Text>
            <Text style={styles.stateBody}>Announcements and updates will appear here.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {notifications.map((n) => {
              const badge = CATEGORY_BADGES[n.category] ?? CATEGORY_BADGES.announcement;
              return (
                <Pressable
                  key={n.id}
                  style={({ pressed }) => [styles.notifCard, !n.read && styles.notifUnread, pressed && styles.pressed]}
                  onPress={() => handleOpenNotification(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`${n.read ? '' : 'Unread. '}${n.title}. ${n.body}`}
                >
                  <View style={[styles.iconBadge, { backgroundColor: badge.bg }]}>
                    <Ionicons name={badge.icon} size={18} color={badge.tint} />
                  </View>
                  <View style={styles.flexText}>
                    <View style={styles.notifHeaderRow}>
                      <Text style={[styles.notifTitle, !n.read && styles.notifTitleUnread]} numberOfLines={1}>
                        {n.title}
                      </Text>
                      <Text style={styles.notifTime}>{formatRelative(n.createdAt)}</Text>
                    </View>
                    <Text style={styles.notifBody}>{n.body}</Text>
                  </View>
                  {!n.read && <View style={styles.unreadDot} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, position: 'relative', overflow: 'hidden' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flexText: { flex: 1 },
  pressed: { opacity: 0.7 },

  banner: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: spacing.md, marginBottom: spacing.lg,
  },
  bannerDanger: { borderColor: '#F3C6C6' },
  bannerTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  pillButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    alignSelf: 'flex-start', backgroundColor: colors.green,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999,
  },
  pillButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  retryButton: { alignSelf: 'center', marginTop: spacing.lg },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sectionHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.sm },
  sectionSpacing: { marginTop: spacing.xl },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countPill: { backgroundColor: colors.badge.greenBg, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  countPillText: { fontSize: 11, fontWeight: '700', color: colors.green },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.green },

  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  reminderRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 40 + spacing.md },
  iconBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconBadgeLarge: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start',
    marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: 999, backgroundColor: colors.background,
  },
  timeChipOn: { backgroundColor: colors.badge.greenBg },
  timeChipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  timeChipTextOn: { color: colors.green },
  switchSlot: { minWidth: 52, alignItems: 'flex-end', justifyContent: 'center' },

  list: { gap: spacing.sm },
  notifCard: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  notifUnread: { backgroundColor: colors.blobLight, borderColor: colors.badge.greenBg },
  notifHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notifTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  notifTitleUnread: { fontWeight: '700' },
  notifTime: { fontSize: 11, color: colors.textSecondary },
  notifBody: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginTop: 6 },

  emptyCard: {
    alignItems: 'center', padding: spacing.xl, backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  stateTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  stateBody: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },

  leafWrap: { position: 'absolute' },
  leafBottomRight: { bottom: -50, right: -60 },
});
