import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getUnreadCount } from '../services/notificationHistoryService';
import { getWatchSummary, isWatchConnected } from '../services/healthConnectService';
import {
  WATCH_METRICS, formatWatchValue, timeAgo, watchMetricStatus, type Tone, type WatchSummary,
} from '../types/smartwatch';
import MonthAnalysis from '../components/MonthAnalysis';

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  good: { bg: colors.badge.greenBg, fg: colors.green },
  warn: { bg: colors.badge.orangeBg, fg: colors.badge.orangeIcon },
  bad: { bg: '#FCE1E1', fg: colors.danger },
  info: { bg: colors.badge.blueBg, fg: colors.badge.blueIcon },
};
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import LeafAccent from '../components/LeafAccent';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const initials = user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '?';
  const [unreadCount, setUnreadCount] = useState(0);
  const [watch, setWatch] = useState<WatchSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const openWatch = () => navigation.getParent()?.navigate('Watch' as never);

  // Latest reading for each watch metric that has data (up to 6), for "Your health metrics".
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
      getUnreadCount(user.id).then(setUnreadCount).catch(() => setUnreadCount(0));
      // Wellness Summary: latest watch readings, if a watch is connected.
      isWatchConnected(user.id)
        .then((connected) => (connected ? getWatchSummary() : null))
        .then(setWatch)
        .catch(() => setWatch(null));
    }, [user])
  );

  const goToProfile = () => navigation.getParent()?.navigate('Profile' as never);

  return (
    <View style={styles.screen}>
      <View style={[styles.leafWrap, styles.leafTopLeft]}>
        <LeafAccent size={150} color={colors.green} rotation={-15} opacity={0.14} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingLabel}>Hello, {firstName} 👋</Text>
            <Text style={styles.greetingSubtitle}>How can we help you today?</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.sosButton, pressed && styles.cardPressed]}
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
            <Pressable style={styles.avatarButton} onPress={goToProfile}>
              <Text style={styles.avatarText}>{initials}</Text>
            </Pressable>
          </View>
        </View>

                <View style={styles.promoRow}>
          <Pressable
            style={({ pressed }) => [styles.promoCard, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('HealthRecords')}
          >
            <View style={[styles.promoIcon, { backgroundColor: colors.badge.greenBg }]}>
              <Ionicons name="document-text-outline" size={22} color={colors.badge.greenIcon} />
            </View>
            <Text style={styles.promoTitle}>Health Records</Text>
            <Text style={styles.promoSubtitle}>Track your vitals & documents</Text>
            <Text style={styles.promoLink}>View Records →</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.promoCard, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('Challenges')}
          >
            <View style={[styles.promoIcon, { backgroundColor: colors.badge.orangeBg }]}>
              <Ionicons name="walk-outline" size={22} color={colors.badge.orangeIcon} />
            </View>
            <Text style={styles.promoTitle}>Challenges</Text>
            <Text style={styles.promoSubtitle}>Join fitness challenges</Text>
            <Text style={styles.promoLink}>Join Now →</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.cardPressed]}
          onPress={() => navigation.getParent()?.navigate('Watch' as never)}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.badge.greenBg }]}>
            <Ionicons name="watch-outline" size={22} color={colors.badge.greenIcon} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Smartwatch data</Text>
            <Text style={styles.rowSubtitle}>Heart rate, SpO2, sleep & more from your watch</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('FollowUps')}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.badge.purpleBg }]}>
            <Ionicons name="calendar-outline" size={22} color={colors.badge.purpleIcon} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Follow-ups</Text>
            <Text style={styles.rowSubtitle}>Appointments, tests & medication reminders</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('Expenses')}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.badge.greenBg }]}>
            <Ionicons name="wallet-outline" size={22} color={colors.badge.greenIcon} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Medical Expenses</Text>
            <Text style={styles.rowSubtitle}>Track bills, medicines & healthcare costs</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('Directory')}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.badge.blueBg }]}>
            <Ionicons name="location-outline" size={22} color={colors.badge.blueIcon} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Healthcare Directory</Text>
            <Text style={styles.rowSubtitle}>Find nearby hospitals, clinics & pharmacies</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.row, styles.rowDanger, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate('Emergency')}
        >
          <View style={[styles.rowIcon, { backgroundColor: '#FCE1E1' }]}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowTitle}>Emergency Assistance</Text>
            <Text style={styles.rowSubtitle}>Trusted contacts, Medical ID & helplines</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>

        {/* Wellness Summary — day-by-day chart for one metric since the 1st, with lowest / highest */}
        {user && (
          <MonthAnalysis
            userId={user.id}
            refreshKey={refreshKey}
            onViewAll={(metric) => navigation.navigate('Trends', { metric })}
            onConnectWatch={openWatch}
          />
        )}

        {/* Your health metrics — latest watch readings */}
        <View style={styles.summaryHeaderRow}>
          <Text style={styles.metricsTitle}>Your health metrics</Text>
          {watch && (
            <Pressable onPress={openWatch} hitSlop={8}>
              <Text style={styles.viewAllLink}>View all →</Text>
            </Pressable>
          )}
        </View>
        {watch && latestMetrics.length > 0 ? (
          <View style={styles.metricsGrid}>
            {latestMetrics.map(({ def, latest, status }) => (
              <Pressable
                key={def.key}
                style={({ pressed }) => [styles.metricCard, pressed && styles.cardPressed]}
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
          <Pressable style={({ pressed }) => [styles.summaryCard, pressed && styles.cardPressed]} onPress={openWatch}>
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

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  greetingLabel: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  greetingSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
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
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  promoRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  promoCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  promoIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  promoTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  promoSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.sm },
  promoLink: { fontSize: 12, fontWeight: '700', color: colors.green },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.md,
  },
  rowDanger: { borderColor: '#F3C6C6' },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardPressed: { opacity: 0.7 },

  summaryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  viewAllLink: { fontSize: 13, fontWeight: '700', color: colors.green },
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  summaryPlaceholder: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  metricsTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
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