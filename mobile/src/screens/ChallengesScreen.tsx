import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import ProgressRing from '../components/ProgressRing';
import { getChallenge, getRuns, syncWatchProgress } from '../services/challengesService';
import {
  CATEGORY_LABELS,
  CHALLENGES,
  DIFFICULTY_LABELS,
  dayKey,
  formatAmount,
  fromDayKey,
  runProgress,
  type ChallengeCategory,
  type ChallengeDifficulty,
  type ChallengeRun,
} from '../types/challenges';
import { formatCalendarDate } from '../types/followUps';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Challenges'>;
type Tab = 'active' | 'discover' | 'achievements';

const CATEGORY_TINT: Record<ChallengeCategory, { bg: string; fg: string }> = {
  activity: { bg: colors.badge.greenBg, fg: colors.badge.greenIcon },
  mindfulness: { bg: colors.badge.purpleBg, fg: colors.badge.purpleIcon },
  nutrition: { bg: colors.badge.orangeBg, fg: colors.badge.orangeIcon },
  sleep: { bg: colors.badge.blueBg, fg: colors.badge.blueIcon },
};

const DIFFICULTY_TINT: Record<ChallengeDifficulty, string> = {
  easy: colors.green,
  medium: colors.badge.orangeIcon,
  hard: colors.danger,
};

const FILTERS: ('all' | ChallengeCategory)[] = ['all', 'activity', 'mindfulness', 'nutrition', 'sleep'];

export default function ChallengesScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [runs, setRuns] = useState<ChallengeRun[]>([]);
  const [tab, setTab] = useState<Tab>('active');
  const [filter, setFilter] = useState<'all' | ChallengeCategory>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(
    async (withWatch: boolean) => {
      if (!user) return;
      setLoadError(false);
      try {
        if (withWatch) await syncWatchProgress(user.id).catch(() => false);
        const list = await getRuns(user.id);
        setRuns(list);
        setTab((current) => (current === 'active' && !list.some((r) => r.status === 'active') ? 'discover' : current));
      } catch {
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  const refresh = async () => {
    setIsRefreshing(true);
    await load(true);
    setIsRefreshing(false);
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
        <Text style={styles.muted}>Couldn’t load challenges.</Text>
        <Pressable onPress={() => { setIsLoading(true); load(true); }} hitSlop={8}>
          <Text style={styles.link}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const today = dayKey(new Date());
  const active = runs.filter((r) => r.status === 'active');
  const completed = runs.filter((r) => r.status === 'completed');
  const ended = runs.filter((r) => r.status === 'ended');
  const bestStreak = active.reduce((max, r) => {
    const c = getChallenge(r.challengeId);
    return c ? Math.max(max, runProgress(r, c, today).streak) : max;
  }, 0);
  const activeIds = new Set(active.map((r) => r.challengeId));
  const catalog = CHALLENGES.filter((c) => filter === 'all' || c.category === filter);

  const renderActive = (run: ChallengeRun) => {
    const c = getChallenge(run.challengeId);
    if (!c) return null;
    const p = runProgress(run, c, today);
    const tint = CATEGORY_TINT[c.category];
    const todayText =
      c.mode === 'total'
        ? `${formatAmount(p.totalValue, c.unit)} of ${formatAmount(c.target, c.unit)}`
        : c.mode === 'check'
          ? p.todayValue > 0 ? 'Done today ✓' : 'Not checked in today'
          : `Today: ${formatAmount(p.todayValue, c.unit)} / ${formatAmount(c.target, c.unit)}`;
    return (
      <Pressable
        key={run.id}
        style={({ pressed }) => [styles.activeCard, pressed && styles.pressed]}
        onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id })}
      >
        <ProgressRing size={64} stroke={7} percent={p.percent} color={tint.fg}>
          <Ionicons name={c.icon} size={22} color={tint.fg} />
        </ProgressRing>
        <View style={styles.flex}>
          <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
          <Text style={styles.cardMeta}>
            Day {p.dayNumber} of {c.durationDays}
            {c.mode !== 'total' ? ` · ${p.daysMet}/${c.durationDays} days done` : ''}
          </Text>
          <Text style={[styles.todayText, { color: tint.fg }]} numberOfLines={1}>{todayText}</Text>
          {c.autoSource && (
            <View style={styles.autoChip}>
              <Ionicons name="watch-outline" size={11} color={colors.green} />
              <Text style={styles.autoChipText}>Auto from watch</Text>
            </View>
          )}
        </View>
        <View style={styles.percentWrap}>
          <Text style={[styles.percent, { color: tint.fg }]}>{p.percent}%</Text>
          {p.streak > 1 && <Text style={styles.streak}>🔥 {p.streak}</Text>}
        </View>
      </Pressable>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} colors={[colors.green]} />}
    >
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{active.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>🏅 {completed.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>🔥 {bestStreak}</Text>
          <Text style={styles.statLabel}>Best streak</Text>
        </View>
      </View>

      <View style={styles.segment}>
        {(['active', 'discover', 'achievements'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.segmentItem, tab === t && styles.segmentItemActive]} onPress={() => setTab(t)}>
            <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
              {t === 'active' ? `Active${active.length ? ` (${active.length})` : ''}` : t === 'discover' ? 'Discover' : 'Achievements'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'active' &&
        (active.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={34} color={colors.green} />
            <Text style={styles.emptyTitle}>No active challenges</Text>
            <Text style={styles.muted}>Pick one to build a healthy habit — most take just a week.</Text>
            <Pressable style={({ pressed }) => [styles.pill, pressed && styles.pressed]} onPress={() => setTab('discover')}>
              <Text style={styles.pillText}>Discover challenges</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>{active.map(renderActive)}</View>
        ))}

      {tab === 'discover' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((f) => (
              <Pressable key={f} style={[styles.filter, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                  {f === 'all' ? 'All' : CATEGORY_LABELS[f]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.list}>
            {catalog.map((c) => {
              const tint = CATEGORY_TINT[c.category];
              const joined = activeIds.has(c.id);
              const goal =
                c.mode === 'total'
                  ? `${formatAmount(c.target, c.unit)} in ${c.durationDays} days`
                  : c.mode === 'check'
                    ? `${c.durationDays} days in a row`
                    : `${formatAmount(c.target, c.unit)} a day · ${c.durationDays} days`;
              return (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [styles.discoverCard, pressed && styles.pressed]}
                  onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id })}
                >
                  <View style={[styles.discoverIcon, { backgroundColor: tint.bg }]}>
                    <Ionicons name={c.icon} size={24} color={tint.fg} />
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.cardTitle, styles.flex]} numberOfLines={1}>{c.title}</Text>
                      <Text style={[styles.difficulty, { color: DIFFICULTY_TINT[c.difficulty] }]}>
                        {DIFFICULTY_LABELS[c.difficulty]}
                      </Text>
                    </View>
                    <Text style={styles.cardMeta} numberOfLines={2}>{c.description}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.goal}>{goal}</Text>
                      {c.autoSource && <Ionicons name="watch-outline" size={13} color={colors.green} />}
                    </View>
                  </View>
                  {joined ? (
                    <View style={styles.joinedChip}>
                      <Text style={styles.joinedText}>Joined</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {tab === 'achievements' &&
        (completed.length === 0 && ended.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.medalLarge}>🏅</Text>
            <Text style={styles.emptyTitle}>No badges yet</Text>
            <Text style={styles.muted}>Finish a challenge to earn your first badge.</Text>
          </View>
        ) : (
          <>
            {completed.length > 0 && (
              <View style={styles.badgeGrid}>
                {completed.map((run) => {
                  const c = getChallenge(run.challengeId);
                  if (!c) return null;
                  return (
                    <Pressable
                      key={run.id}
                      style={({ pressed }) => [styles.badge, pressed && styles.pressed]}
                      onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id, runId: run.id })}
                    >
                      <Text style={styles.medal}>🏅</Text>
                      <Text style={styles.badgeTitle} numberOfLines={2}>{c.title}</Text>
                      <Text style={styles.badgeDate}>
                        {run.finishedAt ? formatCalendarDate(new Date(run.finishedAt)) : formatCalendarDate(fromDayKey(run.endDate))}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {ended.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>NOT COMPLETED</Text>
                <View style={styles.list}>
                  {ended.map((run) => {
                    const c = getChallenge(run.challengeId);
                    if (!c) return null;
                    const p = runProgress(run, c, today);
                    return (
                      <Pressable
                        key={run.id}
                        style={({ pressed }) => [styles.endedCard, pressed && styles.pressed]}
                        onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id, runId: run.id })}
                      >
                        <Ionicons name={c.icon} size={20} color={colors.textSecondary} />
                        <View style={styles.flex}>
                          <Text style={styles.cardTitle}>{c.title}</Text>
                          <Text style={styles.cardMeta}>
                            {p.percent}% · ended {formatCalendarDate(fromDayKey(run.endDate))}
                          </Text>
                        </View>
                        <Text style={styles.link}>Try again</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  muted: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  link: { fontSize: 13, fontWeight: '700', color: colors.green },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginTop: 2 },

  segment: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    padding: 4, marginTop: spacing.md, marginBottom: spacing.md,
  },
  segmentItem: { flex: 1, paddingVertical: spacing.sm, borderRadius: 999, alignItems: 'center' },
  segmentItemActive: { backgroundColor: colors.green },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  segmentTextActive: { color: '#FFFFFF' },

  list: { gap: spacing.sm },
  activeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  todayText: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  autoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.blobLight,
  },
  autoChipText: { fontSize: 10, fontWeight: '800', color: colors.green },
  percentWrap: { alignItems: 'flex-end' },
  percent: { fontSize: 18, fontWeight: '800' },
  streak: { fontSize: 12, fontWeight: '700', color: colors.badge.orangeIcon, marginTop: 2 },

  filters: { gap: spacing.sm, paddingBottom: spacing.md },
  filter: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  filterActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  filterText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  filterTextActive: { color: '#FFFFFF' },
  discoverCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  discoverIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  difficulty: { fontSize: 11, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  goal: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  joinedChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.badge.greenBg },
  joinedText: { fontSize: 11, fontWeight: '800', color: colors.green },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: 999, backgroundColor: colors.green,
  },
  pillText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    width: '31.5%', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xs,
    borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  medal: { fontSize: 34 },
  medalLarge: { fontSize: 44 },
  badgeTitle: { fontSize: 12, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginTop: 4 },
  badgeDate: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: spacing.sm },
  endedCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
});
