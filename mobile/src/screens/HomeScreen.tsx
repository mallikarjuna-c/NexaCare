import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import LeafAccent from '../components/LeafAccent';
import MonthAnalysis from '../components/MonthAnalysis';
import BloodAlertCard, { pickAlerts } from '../components/BloodAlertCard';
import { listHelpRequests } from '../services/communityService';
import type { HelpRequest } from '../types/community';
import { getUnreadCount, subscribeToNotifications } from '../services/notificationHistoryService';
import { getUpcomingReminders, type UpcomingReminder } from '../services/notificationService';
import { getWatchSummary, isWatchConnected, uploadWatchSummary } from '../services/healthConnectService';
import {
  WATCH_METRICS, formatWatchValue, timeAgo, watchMetricStatus, type Tone, type WatchSummary,
} from '../types/smartwatch';
import { initialsOf } from '../types/family';
import { formatCalendarDate } from '../types/followUps';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;
type IconName = keyof typeof Ionicons.glyphMap;

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  good: { bg: colors.badge.greenBg, fg: colors.green },
  warn: { bg: colors.badge.orangeBg, fg: colors.badge.orangeIcon },
  bad: { bg: '#FCE1E1', fg: colors.danger },
  info: { bg: colors.badge.blueBg, fg: colors.badge.blueIcon },
};

const QUICK_ACTIONS: {
  label: string;
  hint: string;
  icon: IconName;
  bg: string;
  tint: string;
  screen: 'HealthRecords' | 'FollowUps' | 'Reminders' | 'Expenses';
}[] = [
  { label: 'Health Records', hint: 'Vitals & reports', icon: 'document-text-outline', bg: colors.badge.greenBg, tint: colors.badge.greenIcon, screen: 'HealthRecords' },
  { label: 'Follow-ups', hint: 'Appointments & tests', icon: 'calendar-outline', bg: colors.badge.purpleBg, tint: colors.badge.purpleIcon, screen: 'FollowUps' },
  { label: 'Reminders', hint: 'Upcoming & daily', icon: 'alarm-outline', bg: colors.badge.orangeBg, tint: colors.badge.orangeIcon, screen: 'Reminders' },
  { label: 'Expenses', hint: 'Bills & medicines', icon: 'wallet-outline', bg: colors.badge.blueBg, tint: colors.badge.blueIcon, screen: 'Expenses' },
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function greetingFor(d: Date) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatLongDate(d: Date) {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function formatReminderTime(at: Date) {
  const hour = at.getHours();
  const time = `${hour % 12 || 12}:${String(at.getMinutes()).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(at).setHours(0, 0, 0, 0) - start.getTime()) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  return `${formatCalendarDate(at)}, ${time}`;
}

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { activeProfile } = useFamily();
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const [now, setNow] = useState(() => new Date());
  const [unreadCount, setUnreadCount] = useState(0);
  const [watch, setWatch] = useState<WatchSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [nextReminder, setNextReminder] = useState<UpcomingReminder | null>(null);
  const [bloodAlerts, setBloodAlerts] = useState<{ matches: HelpRequest[]; mine: HelpRequest[] }>({ matches: [], mine: [] });

  const loadBloodAlerts = useCallback(() => {
    Promise.all([listHelpRequests('nearby'), listHelpRequests('mine')])
      .then(([nearby, mine]) => {
        const byId = new Map([...nearby, ...mine].map((r) => [r.id, r]));
        setBloodAlerts(pickAlerts([...byId.values()]));
      })
      .catch(() => {});
  }, []);
  const openWatch = () => navigation.getParent()?.navigate('Watch' as never);
  const openFamily = () => navigation.getParent()?.navigate('Family' as never);
  const openCare = () => navigation.getParent()?.navigate('Care' as never);

  const latestMetrics = watch
    ? WATCH_METRICS.filter((m) => m.key !== 'steps' && m.key !== 'sleep')
        .concat(WATCH_METRICS.filter((m) => m.key === 'steps' || m.key === 'sleep'))
        .map((def) => {
          const latest = watch.metrics[def.key].latest;
          return latest ? { def, latest, status: watchMetricStatus(def.key, latest) } : null;
        })
        .filter((m): m is NonNullable<typeof m> => !!m)
        .slice(0, 6)
    : [];

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setRefreshKey((k) => k + 1);
      setNow(new Date());
      loadBloodAlerts();
      getUnreadCount(user.id).then(setUnreadCount).catch(() => setUnreadCount(0));
      getUpcomingReminders(user.id)
        .then((list) => setNextReminder(list[0] ?? null))
        .catch(() => setNextReminder(null));
      isWatchConnected(user.id)
        .then((connected) => (connected ? getWatchSummary() : null))
        .then((summary) => {
          setWatch(summary);
          if (summary) uploadWatchSummary(user.id, summary).catch(() => {});
        })
        .catch(() => setWatch(null));
    }, [user, loadBloodAlerts])
  );

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(() => {
      getUnreadCount(user.id).then(setUnreadCount).catch(() => {});
      loadBloodAlerts();
    });
  }, [user, loadBloodAlerts]);

  const viewingMember = !!activeProfile && !activeProfile.isSelf;

  return (
    <View style={styles.screen}>
      <View style={[styles.leafWrap, styles.leafTopLeft]}>
        <LeafAccent size={150} color={colors.green} rotation={-15} opacity={0.14} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
          >
            <Text style={styles.avatarText}>{initialsOf(user?.name ?? '')}</Text>
          </Pressable>
          <View style={styles.greetingWrap}>
            <Text style={styles.greetingLine}>{greetingFor(now)}</Text>
            <Text style={styles.greetingName} numberOfLines={1}>
              {firstName}
            </Text>
            {viewingMember ? (
              <Pressable onPress={openFamily} hitSlop={6} style={styles.viewingRow}>
                <Text style={styles.viewingText} numberOfLines={1}>
                  Viewing {activeProfile.name} · {activeProfile.relationLabel}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.green} />
              </Pressable>
            ) : (
              <Text style={styles.dateLine}>{formatLongDate(now)}</Text>
            )}
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.sosButton, pressed && styles.pressed]}
              onPress={() => navigation.navigate('Sos')}
              accessibilityRole="button"
              accessibilityLabel="SOS emergency"
            >
              <Text style={styles.sosText}>SOS</Text>
            </Pressable>
            <Pressable
              style={styles.iconButton}
              onPress={() => navigation.navigate('Notifications')}
              accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        <BloodAlertCard
          matches={bloodAlerts.matches}
          mine={bloodAlerts.mine}
          onOpen={(requestId) => navigation.navigate('HelpRequest', { requestId })}
          onSeeAll={() => navigation.navigate('Community')}
        />

        {nextReminder && (
          <Pressable
            style={({ pressed }) => [styles.nextCard, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Reminders')}
          >
            <View style={styles.nextIcon}>
              <Ionicons name="alarm-outline" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.nextLabel}>NEXT REMINDER · {formatReminderTime(nextReminder.at).toUpperCase()}</Text>
              <Text style={styles.nextTitle} numberOfLines={1}>
                {nextReminder.title}
              </Text>
              {!!nextReminder.body && (
                <Text style={styles.nextBody} numberOfLines={1}>
                  {nextReminder.body}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        )}

        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((a) => (
            <Pressable
              key={a.screen}
              style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}
              onPress={() => navigation.navigate(a.screen)}
              accessibilityRole="button"
              accessibilityLabel={a.label}
            >
              <View style={[styles.quickIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon} size={24} color={a.tint} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>
                {a.label}
              </Text>
              <Text style={styles.quickHint} numberOfLines={1}>
                {a.hint}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={openCare} hitSlop={8} style={styles.allServices}>
          <Text style={styles.linkText}>All services in Care</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.green} />
        </Pressable>

        {user && (
          <MonthAnalysis
            userId={user.id}
            refreshKey={refreshKey}
            onViewAll={(metric) => navigation.navigate('Trends', { metric })}
            onConnectWatch={openWatch}
          />
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your health metrics</Text>
          {watch && (
            <Pressable onPress={openWatch} hitSlop={8}>
              <Text style={styles.linkText}>View all →</Text>
            </Pressable>
          )}
        </View>
        {watch && latestMetrics.length > 0 ? (
          <View style={styles.metricsGrid}>
            {latestMetrics.map(({ def, latest, status }) => (
              <Pressable
                key={def.key}
                style={({ pressed }) => [styles.metricCard, pressed && styles.pressed]}
                onPress={openWatch}
              >
                <View style={styles.metricTop}>
                  <View style={styles.metricIcon}>
                    <Ionicons name={def.icon} size={17} color={colors.green} />
                  </View>
                  {status && (
                    <View style={[styles.metricBadge, { backgroundColor: TONE_STYLES[status.tone].bg }]}>
                      <Text style={[styles.metricBadgeText, { color: TONE_STYLES[status.tone].fg }]}>{status.label}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.metricName} numberOfLines={1}>{def.name}</Text>
                <Text style={styles.metricValue}>
                  {formatWatchValue(def.key, latest)}
                  <Text style={styles.metricUnit}> {def.unit}</Text>
                </Text>
                <Text style={styles.metricTime}>{timeAgo(latest.time)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable style={({ pressed }) => [styles.summaryCard, pressed && styles.pressed]} onPress={openWatch}>
            <Ionicons name="watch-outline" size={20} color={colors.green} />
            <Text style={styles.summaryPlaceholder}>
              {watch
                ? 'No recent readings from your watch. Sync it, then come back.'
                : 'Connect your smartwatch to see your heart rate, blood oxygen, sleep and more here.'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, position: 'relative', overflow: 'hidden' },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.green },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  greetingWrap: { flex: 1 },
  greetingLine: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  greetingName: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 1 },
  dateLine: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  viewingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  viewingText: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: colors.green },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sosButton: {
    height: 40, minWidth: 56, paddingHorizontal: spacing.sm, borderRadius: 20,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  sosText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  bellBadge: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.surface,
  },
  bellBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  avatarButton: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.blobLight,
  },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },

  nextCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg,
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  nextIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.badge.orangeIcon,
    alignItems: 'center', justifyContent: 'center',
  },
  nextLabel: { fontSize: 11, fontWeight: '800', color: colors.badge.orangeIcon, letterSpacing: 0.4 },
  nextTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  nextBody: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  quickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  quickItem: {
    width: '48.5%', backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  quickIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.sm },
  quickHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  allServices: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: spacing.md },

  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  summaryPlaceholder: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: {
    width: '48.5%', backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  metricIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.badge.greenBg, alignItems: 'center', justifyContent: 'center' },
  metricBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, maxWidth: '62%' },
  metricBadgeText: { fontSize: 10, fontWeight: '800' },
  metricName: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  metricValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  metricUnit: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  metricTime: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  leafWrap: { position: 'absolute' },
  leafTopLeft: { top: -30, left: -40 },
});
