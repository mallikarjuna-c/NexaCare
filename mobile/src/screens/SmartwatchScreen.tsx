import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Linking, RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import LeafAccent from '../components/LeafAccent';
import {
  connectHealthConnect,
  getHealthConnectStatus,
  getWatchSummary,
  isWatchConnected,
  openHealthConnect,
  setWatchConnected,
} from '../services/healthConnectService';
import {
  NORMAL_RANGE_TEXT,
  STEP_GOAL,
  WATCH_METRICS,
  WATCH_SCALES,
  formatWatchValue,
  sourceAppName,
  timeAgo,
  watchMetricStatus,
  type DailyValue,
  type HealthConnectStatus,
  type Tone,
  type WatchMetricKey,
  type WatchSummary,
} from '../types/smartwatch';
import { formatCalendarDate } from '../types/followUps';
import { parseLocalISODate } from '../types/expenses';
import { colors, typography, spacing } from '../theme/theme';

const DANGER_TINT = '#FCE1E1';
const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  good: { bg: colors.badge.greenBg, fg: colors.green },
  warn: { bg: colors.badge.orangeBg, fg: colors.badge.orangeIcon },
  bad: { bg: DANGER_TINT, fg: colors.danger },
  info: { bg: colors.badge.blueBg, fg: colors.badge.blueIcon },
};

const HEALTH_CONNECT_STORE_URL = 'market://details?id=com.google.android.apps.healthdata';
// From Android 14 (API 34) Health Connect is part of the operating system.
const HEALTH_CONNECT_BUILT_IN = Platform.OS === 'android' && Number(Platform.Version) >= 34;

const SECTIONS: { title: string; keys: WatchMetricKey[] }[] = [
  { title: 'Heart', keys: ['heartRate', 'restingHeartRate', 'hrv'] },
  { title: 'Breathing & oxygen', keys: ['spo2', 'respiratoryRate'] },
  { title: 'Blood pressure', keys: ['bloodPressure'] },
  { title: 'Activity & sleep', keys: ['steps', 'sleep'] },
];

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CHART_HEIGHT = 120;

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The last 7 calendar days (oldest first), filling days without data with 0.
function lastSevenDays(daily: DailyValue[]): { day: string; letter: string; value: number; isToday: boolean }[] {
  const byDay = new Map(daily.map((d) => [d.day, d.value]));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const day = isoDay(d);
    return { day, letter: DAY_LETTERS[d.getDay()], value: byDay.get(day) ?? 0, isToday: i === 6 };
  });
}

function RangeBar({ value, metricKey, tone }: { value: number; metricKey: WatchMetricKey; tone: Tone }) {
  const s = WATCH_SCALES[metricKey];
  const span = s.max - s.min;
  const clamp = (v: number) => Math.min(100, Math.max(0, ((v - s.min) / span) * 100));
  return (
    <View style={styles.rangeTrack}>
      <View style={[styles.rangeBand, { left: `${clamp(s.normalLo)}%`, width: `${clamp(s.normalHi) - clamp(s.normalLo)}%` }]} />
      <View style={[styles.rangeMarker, { left: `${clamp(value)}%`, backgroundColor: TONE_STYLES[tone].fg }]} />
    </View>
  );
}

// Seven slim bars, today in full green, a dashed goal line; tap a bar to see that day's count.
function WeeklySteps({ daily }: { daily: DailyValue[] }) {
  const days = useMemo(() => lastSevenDays(daily), [daily]);
  const [selected, setSelected] = useState(days.length - 1);
  const max = Math.max(STEP_GOAL * 1.15, ...days.map((d) => d.value));
  const goalBottom = (STEP_GOAL / max) * CHART_HEIGHT;
  const sel = days[selected];
  const weekAvg = Math.round(days.reduce((a, d) => a + d.value, 0) / 7);

  return (
    <View style={styles.card}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>Steps this week</Text>
          <Text style={styles.chartSub}>Daily average {weekAvg.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.chartReadout}>
          <Text style={styles.chartReadoutValue}>{Math.round(sel.value).toLocaleString('en-IN')}</Text>
          <Text style={styles.chartSub}>{sel.isToday ? 'Today' : formatCalendarDate(parseLocalISODate(sel.day))}</Text>
        </View>
      </View>

      <View style={[styles.chartArea, { height: CHART_HEIGHT }]}>
        <View style={[styles.goalLine, { bottom: goalBottom }]} />
        <Text style={[styles.goalLabel, { bottom: goalBottom + 2 }]}>Goal {STEP_GOAL.toLocaleString('en-IN')}</Text>
        {days.map((d, i) => (
          <Pressable
            key={d.day}
            style={styles.barSlot}
            onPress={() => setSelected(i)}
            hitSlop={4}
            accessibilityLabel={`${d.isToday ? 'Today' : d.day}: ${Math.round(d.value)} steps`}
          >
            <View
              style={[
                styles.bar,
                { height: Math.max(3, (d.value / max) * CHART_HEIGHT) },
                i === selected ? styles.barSelected : d.value >= STEP_GOAL ? styles.barGoal : styles.barDefault,
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.dayRow}>
        {days.map((d, i) => (
          <Text key={d.day} style={[styles.dayLetter, i === selected && styles.dayLetterSelected]}>
            {d.letter}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function SmartwatchScreen() {
  const { user } = useAuth();
  const [status, setStatus] = useState<HealthConnectStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [summary, setSummary] = useState<WatchSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    try {
      const s = await getHealthConnectStatus();
      setStatus(s);
      const isConnected = s === 'available' && (await isWatchConnected(user.id));
      setConnected(isConnected);
      if (isConnected) setSummary(await getWatchSummary());
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = () => {
    setIsRefreshing(true);
    load();
  };

  const connect = async () => {
    if (!user || isConnecting) return;
    setIsConnecting(true);
    try {
      const granted = await connectHealthConnect(user.id);
      if (!granted.length) {
        Alert.alert(
          'Nothing was shared',
          'NexaCare needs permission for at least one type of data. You can choose exactly which ones in Health Connect.'
        );
        return;
      }
      setConnected(true);
      setSummary(await getWatchSummary());
    } catch {
      Alert.alert('Couldn’t connect', 'Health Connect didn’t respond. Make sure it’s installed and up to date, then try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () =>
    Alert.alert(
      'Disconnect smartwatch data?',
      'NexaCare will stop reading your watch data. To remove its permissions completely, turn them off in Health Connect too.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            await setWatchConnected(user.id, false);
            setConnected(false);
            setSummary(null);
          },
        },
      ]
    );

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const metrics = summary?.metrics;
  const anyData = metrics ? Object.values(metrics).some((m) => m.latest) : false;
  const grantedCount = metrics ? Object.values(metrics).filter((m) => m.granted).length : 0;
  const sources = metrics
    ? [...new Set(Object.values(metrics).map((m) => m.latest?.source).filter((s): s is string => !!s))]
    : [];

  const isLive = status === 'available' && connected && !!summary;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        isLive ? <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.green} colors={[colors.green]} /> : undefined
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.pageTitle}>Smartwatch</Text>
          {isLive ? (
            <View style={styles.liveRow}>
              <View style={styles.dot} />
              <Text style={styles.liveText}>Connected · updated {timeAgo(summary!.fetchedAt)}</Text>
            </View>
          ) : (
            <Text style={styles.pageSub}>Real sensor data from your watch or band</Text>
          )}
        </View>
        {isLive && (
          <Pressable style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} onPress={refresh} accessibilityLabel="Refresh">
            {isRefreshing ? <ActivityIndicator size="small" color={colors.green} /> : <Ionicons name="refresh" size={20} color={colors.green} />}
          </Pressable>
        )}
      </View>

      {loadError && (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>We couldn’t read Health Connect just now. Pull down to try again.</Text>
        </View>
      )}

      {/* ---------- Health Connect not usable ---------- */}
      {status === 'unavailable' &&
        (HEALTH_CONNECT_BUILT_IN ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Couldn’t reach Health Connect</Text>
            <Text style={styles.cardText}>
              Health Connect is built into your phone, but NexaCare couldn’t talk to it. Make sure you have the latest
              NexaCare, then close and reopen the app.
            </Text>
            <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]} onPress={() => { setIsLoading(true); load(); }}>
              <Text style={typography.button}>Try again</Text>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Health Connect isn’t installed</Text>
            <Text style={styles.cardText}>
              On your Android version, Health Connect is a separate app. Install it from the Play Store, then come back.
            </Text>
            <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]} onPress={() => Linking.openURL(HEALTH_CONNECT_STORE_URL).catch(() => {})}>
              <Text style={typography.button}>Get Health Connect</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}

      {status === 'update_required' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Update Health Connect</Text>
          <Text style={styles.cardText}>A newer version of Health Connect is needed before NexaCare can read your data.</Text>
          <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]} onPress={() => Linking.openURL(HEALTH_CONNECT_STORE_URL).catch(() => {})}>
            <Text style={typography.button}>Update</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {/* ---------- Not connected: onboarding ---------- */}
      {status === 'available' && !connected && (
        <>
          <View style={styles.hero}>
            <View style={styles.heroLeaf} pointerEvents="none">
              <LeafAccent size={150} color={colors.green} rotation={200} opacity={0.12} />
            </View>
            <View style={styles.watchHalo}>
              <View style={styles.watchCircle}>
                <Ionicons name="watch-outline" size={34} color={colors.green} />
              </View>
            </View>
            <Text style={styles.heroTitle}>Bring in your watch data</Text>
            <Text style={styles.heroText}>
              The most accurate readings NexaCare can show — straight from your watch’s sensors, through Android Health
              Connect.
            </Text>
            {[
              { icon: 'heart-outline' as const, text: 'Heart rate, HRV, blood oxygen & breathing' },
              { icon: 'moon-outline' as const, text: 'Sleep and daily steps' },
              { icon: 'lock-closed-outline' as const, text: 'Read-only — you choose exactly what to share' },
            ].map((b) => (
              <View key={b.text} style={styles.benefitRow}>
                <Ionicons name={b.icon} size={16} color={colors.green} />
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>How to connect</Text>
          <View style={styles.card}>
            {[
              'Make sure your watch syncs with its phone app (Samsung Health, Fitbit, Google Fit…).',
              'In that app’s settings, turn on sharing with Health Connect.',
              'Tap Connect below and choose which data NexaCare may read.',
            ].map((text, i) => (
              <View key={text} style={[styles.stepRow, i > 0 && styles.stepRowSpaced]}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{text}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.cta, (pressed || isConnecting) && styles.pressed]}
            onPress={connect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={typography.button}>Connect</Text>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </>
      )}

      {/* ---------- Connected ---------- */}
      {isLive && metrics && (
        <>
          {!anyData ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No watch data yet</Text>
              <Text style={styles.cardText}>
                {grantedCount === 0
                  ? 'NexaCare isn’t allowed to read any data. Open Health Connect and allow the data you want to share.'
                  : 'Nothing has arrived in the last 7 days. Open your watch’s app, sync it, and check it shares data with Health Connect — then pull down to refresh.'}
              </Text>
            </View>
          ) : (
            <>
              {/* Today */}
              <View style={styles.hero}>
                <View style={styles.heroLeaf} pointerEvents="none">
                  <LeafAccent size={150} color={colors.green} rotation={200} opacity={0.12} />
                </View>
                <Text style={styles.heroEyebrow}>Today</Text>
                <View style={styles.heroMain}>
                  <View style={styles.heroHeart}>
                    <Ionicons name="heart" size={24} color={colors.danger} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.heroLabel}>Heart rate</Text>
                    <Text style={styles.heroValue}>
                      {metrics.heartRate.latest ? Math.round(metrics.heartRate.latest.value) : '--'}
                      <Text style={styles.heroUnit}> bpm</Text>
                    </Text>
                    {metrics.heartRate.latest && (
                      <Text style={styles.heroMeta}>{timeAgo(metrics.heartRate.latest.time)}</Text>
                    )}
                  </View>
                  {metrics.heartRate.latest && (() => {
                    const st = watchMetricStatus('heartRate', metrics.heartRate.latest);
                    return st ? (
                      <View style={[styles.badge, { backgroundColor: TONE_STYLES[st.tone].bg }]}>
                        <Text style={[styles.badgeText, { color: TONE_STYLES[st.tone].fg }]}>{st.label}</Text>
                      </View>
                    ) : null;
                  })()}
                </View>

                <View style={styles.miniRow}>
                  <View style={styles.miniTile}>
                    <Ionicons name="walk-outline" size={16} color={colors.green} />
                    <Text style={styles.miniValue}>
                      {metrics.steps.latest ? Math.round(metrics.steps.latest.value).toLocaleString('en-IN') : '--'}
                    </Text>
                    <Text style={styles.miniLabel}>steps</Text>
                    <View style={styles.miniTrack}>
                      <View
                        style={[
                          styles.miniFill,
                          { width: `${Math.min(100, ((metrics.steps.latest?.value ?? 0) / STEP_GOAL) * 100)}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.miniTile}>
                    <Ionicons name="moon-outline" size={16} color={colors.green} />
                    <Text style={styles.miniValue}>{metrics.sleep.latest ? metrics.sleep.latest.value.toFixed(1) : '--'}</Text>
                    <Text style={styles.miniLabel}>h sleep</Text>
                  </View>
                  <View style={styles.miniTile}>
                    <Ionicons name="water-outline" size={16} color={colors.green} />
                    <Text style={styles.miniValue}>{metrics.spo2.latest ? Math.round(metrics.spo2.latest.value) : '--'}</Text>
                    <Text style={styles.miniLabel}>% SpO₂</Text>
                  </View>
                </View>
              </View>

              {metrics.steps.daily.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>This week</Text>
                  <WeeklySteps daily={metrics.steps.daily} />
                </>
              )}
            </>
          )}

          {/* Sections */}
          {SECTIONS.map((section) => (
            <View key={section.title}>
              <Text style={styles.sectionLabel}>{section.title}</Text>
              <View style={styles.listCard}>
                {section.keys.map((key, i) => {
                  const def = WATCH_METRICS.find((m) => m.key === key)!;
                  const metric = metrics[key];
                  const latest = metric.latest;
                  const st = latest ? watchMetricStatus(key, latest) : null;
                  return (
                    <View key={key}>
                      {i > 0 && <View style={styles.divider} />}
                      <Pressable
                        style={({ pressed }) => [styles.row, !latest && !metric.granted && pressed && styles.pressed]}
                        onPress={!latest && !metric.granted ? openHealthConnect : undefined}
                        disabled={!!latest || metric.granted}
                      >
                        <View style={[styles.rowIcon, !latest && styles.rowIconMuted]}>
                          <Ionicons name={def.icon} size={18} color={latest ? colors.green : colors.textSecondary} />
                        </View>
                        <View style={styles.flex}>
                          <View style={styles.rowTop}>
                            <Text style={[styles.rowName, !latest && styles.rowNameMuted]} numberOfLines={1}>
                              {def.name}
                            </Text>
                            {latest ? (
                              <Text style={styles.rowValue}>
                                {formatWatchValue(key, latest)}
                                <Text style={styles.rowUnit}> {def.unit}</Text>
                              </Text>
                            ) : (
                              <Text style={styles.rowDash}>—</Text>
                            )}
                          </View>
                          {latest && st ? (
                            <>
                              <View style={styles.rowMeta}>
                                <View style={[styles.badge, { backgroundColor: TONE_STYLES[st.tone].bg }]}>
                                  <Text style={[styles.badgeText, { color: TONE_STYLES[st.tone].fg }]}>{st.label}</Text>
                                </View>
                                <Text style={styles.rowRange} numberOfLines={1}>{NORMAL_RANGE_TEXT[key]}</Text>
                              </View>
                              <RangeBar value={latest.value} metricKey={key} tone={st.tone} />
                              <Text style={styles.rowSource} numberOfLines={1}>
                                {metric.average7d != null
                                  ? `${def.averageLabel} ${key === 'sleep' ? metric.average7d.toFixed(1) : Math.round(metric.average7d).toLocaleString('en-IN')} · `
                                  : ''}
                                {sourceAppName(latest.source)} · {timeAgo(latest.time)}
                              </Text>
                            </>
                          ) : (
                            <Text style={[styles.rowMissing, !metric.granted && styles.rowMissingAction]}>
                              {metric.granted ? 'No data in the last 7 days' : 'Not allowed — tap to allow in Health Connect ›'}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Sources & settings */}
          <Text style={styles.sectionLabel}>Data sources</Text>
          <View style={styles.card}>
            {sources.length ? (
              <View style={styles.sourceChips}>
                {sources.map((s) => (
                  <View key={s} style={styles.sourceChip}>
                    <Ionicons name="phone-portrait-outline" size={13} color={colors.green} />
                    <Text style={styles.sourceChipText}>{sourceAppName(s)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.cardText}>No apps have shared data with NexaCare yet.</Text>
            )}
            <Text style={[styles.cardText, styles.sourceNote]}>
              {grantedCount} of {WATCH_METRICS.length} data types allowed. Read through Android Health Connect.
            </Text>
            <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={openHealthConnect}>
              <Ionicons name="settings-outline" size={18} color={colors.green} />
              <Text style={styles.secondaryText}>Manage permissions</Text>
            </Pressable>
          </View>

          <Pressable style={styles.disconnect} onPress={disconnect} hitSlop={8}>
            <Ionicons name="unlink-outline" size={15} color={colors.danger} />
            <Text style={styles.disconnectText}>Disconnect</Text>
          </Pressable>
        </>
      )}

      <Text style={styles.footnote}>
        Read-only: NexaCare never changes your watch data, and readings stay on this phone. Watch readings are for
        general wellness, not a medical diagnosis.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  pageTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  pageSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  liveText: { fontSize: 13, fontWeight: '600', color: colors.green },
  iconButton: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },

  errorCard: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginBottom: spacing.md,
    backgroundColor: DANGER_TINT, borderRadius: 12, padding: spacing.md,
  },
  errorText: { flex: 1, fontSize: 13, color: colors.danger, lineHeight: 18 },

  hero: {
    backgroundColor: colors.blobLight, borderRadius: 24, borderWidth: 1, borderColor: colors.badge.greenBg,
    padding: spacing.lg, overflow: 'hidden',
  },
  heroLeaf: { position: 'absolute', right: -45, bottom: -55 },
  heroEyebrow: { fontSize: 12, fontWeight: '800', color: colors.green, textTransform: 'uppercase', letterSpacing: 0.6 },
  heroMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  heroHeart: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  heroLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  heroValue: { fontSize: 34, fontWeight: '800', color: colors.textPrimary, lineHeight: 40 },
  heroUnit: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  heroMeta: { fontSize: 11, color: colors.textSecondary },
  heroTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginTop: spacing.md },
  heroText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.sm },
  watchHalo: {
    alignSelf: 'center', width: 96, height: 96, borderRadius: 48, backgroundColor: colors.badge.greenBg,
    alignItems: 'center', justifyContent: 'center',
  },
  watchCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  benefitText: { flex: 1, fontSize: 13, color: colors.textPrimary },

  miniRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  miniTile: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, gap: 2 },
  miniValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 4 },
  miniLabel: { fontSize: 11, color: colors.textSecondary },
  miniTrack: { height: 4, borderRadius: 2, backgroundColor: colors.background, marginTop: 4, overflow: 'hidden' },
  miniFill: { height: 4, borderRadius: 2, backgroundColor: colors.green },

  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: spacing.xs },

  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  chartTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  chartSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  chartReadout: { alignItems: 'flex-end' },
  chartReadoutValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.textSecondary, opacity: 0.5 },
  goalLabel: { position: 'absolute', right: 0, fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '62%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barDefault: { backgroundColor: colors.badge.greenBg },
  barGoal: { backgroundColor: colors.green, opacity: 0.45 },
  barSelected: { backgroundColor: colors.green },
  dayRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  dayLetter: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  dayLetterSelected: { color: colors.green, fontWeight: '800' },

  listCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 38 + spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, alignItems: 'flex-start' },
  rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.badge.greenBg, alignItems: 'center', justifyContent: 'center' },
  rowIconMuted: { backgroundColor: colors.background },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  rowName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowNameMuted: { color: colors.textSecondary },
  rowValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  rowUnit: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  rowDash: { fontSize: 18, fontWeight: '700', color: colors.border },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  rowRange: { flex: 1, fontSize: 11, color: colors.textSecondary },
  rowSource: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  rowMissing: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  rowMissingAction: { color: colors.green, fontWeight: '700' },

  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '800' },

  rangeTrack: { height: 6, borderRadius: 3, backgroundColor: colors.background, marginTop: spacing.sm, justifyContent: 'center' },
  rangeBand: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3, backgroundColor: colors.badge.greenBg },
  rangeMarker: { position: 'absolute', width: 12, height: 12, borderRadius: 6, marginLeft: -6, borderWidth: 2, borderColor: colors.surface },

  stepRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepRowSpaced: { marginTop: spacing.md },
  stepNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.badge.greenBg, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 13, fontWeight: '800', color: colors.green },
  stepText: { flex: 1, fontSize: 13, color: colors.textPrimary, lineHeight: 19 },

  sourceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sourceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.badge.greenBg, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  sourceChipText: { fontSize: 12, fontWeight: '700', color: colors.green },
  sourceNote: { marginTop: spacing.sm },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, borderRadius: 30, minHeight: 56, marginTop: spacing.lg, paddingHorizontal: spacing.lg,
  },
  secondaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    minHeight: 48, borderRadius: 30, borderWidth: 1.5, borderColor: colors.green, marginTop: spacing.md,
  },
  secondaryText: { fontSize: 15, fontWeight: '700', color: colors.green },
  disconnect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.sm, marginTop: spacing.md },
  disconnectText: { fontSize: 13, fontWeight: '700', color: colors.danger },

  footnote: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 17, marginTop: spacing.lg },
});
