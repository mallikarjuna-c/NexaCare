import { useCallback, useLayoutEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import ProgressRing from '../components/ProgressRing';
import {
  getActiveRun, getChallenge, getRun, joinChallenge, leaveChallenge, logEntry, removeEntry, syncWatchProgress,
} from '../services/challengesService';
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  dayKey,
  formatAmount,
  fromDayKey,
  runProgress,
  type ChallengeRun,
} from '../types/challenges';
import { formatCalendarDate } from '../types/followUps';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'ChallengeDetail'>;

const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function ChallengeDetailScreen({ navigation, route }: Props) {
  const { challengeId, runId } = route.params;
  const { user } = useAuth();
  const challenge = getChallenge(challengeId);
  const [run, setRun] = useState<ChallengeRun | null>(null);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: challenge?.title ?? 'Challenge' });
  }, [navigation, challenge?.title]);

  const load = useCallback(async () => {
    if (!user || !challenge) return;
    setLoadError(false);
    try {
      if (challenge.autoSource) await syncWatchProgress(user.id).catch(() => false);
      setRun(runId ? await getRun(user.id, runId) : await getActiveRun(user.id, challenge.id));
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [user, challenge, runId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (action: () => Promise<ChallengeRun | void>) => {
    setIsBusy(true);
    try {
      const result = await action();
      if (result) setRun(result);
    } catch (error) {
      Alert.alert('Something went wrong', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const join = () => {
    if (!user || !challenge) return;
    act(async () => {
      const fresh = await joinChallenge(user.id, challenge.id);
      navigation.setParams({ runId: undefined });
      return (await getRun(user.id, fresh.id)) ?? fresh;
    });
  };

  const add = (value: number) => {
    if (!user || !run) return;
    act(() => logEntry(user.id, run.id, value));
  };

  const addCustom = () => {
    const value = Number(amount.replace(',', '.'));
    if (!value || value <= 0) {
      Alert.alert('Enter an amount', 'Please enter a number greater than 0.');
      return;
    }
    setAmount('');
    add(value);
  };

  const undo = (entryId: string) => {
    if (!user || !run) return;
    act(() => removeEntry(user.id, run.id, entryId));
  };

  const confirmLeave = () =>
    Alert.alert('Leave this challenge?', 'Your progress will stop counting. You can join again any time.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () =>
          act(async () => {
            if (!user || !run) return;
            await leaveChallenge(user.id, run.id);
            navigation.goBack();
          }),
      },
    ]);

  const remindMe = () => {
    if (!challenge) return;
    navigation.navigate('AddReminder', {
      preset: { kind: 'activity', title: challenge.title, times: [challenge.reminderTime] },
    });
  };

  if (!challenge) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>This challenge is no longer available.</Text>
      </View>
    );
  }

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
        <Text style={styles.muted}>Couldn’t load this challenge.</Text>
        <Pressable onPress={() => { setIsLoading(true); load(); }} hitSlop={8}>
          <Text style={styles.link}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const today = dayKey(new Date());
  const goalText =
    challenge.mode === 'total'
      ? `${formatAmount(challenge.target, challenge.unit)} within ${challenge.durationDays} days`
      : challenge.mode === 'check'
        ? `Check in every day for ${challenge.durationDays} days`
        : `${formatAmount(challenge.target, challenge.unit)} every day for ${challenge.durationDays} days`;

  const overview = (
    <>
      <View style={styles.infoRow}>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>{CATEGORY_LABELS[challenge.category]}</Text>
        </View>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>{DIFFICULTY_LABELS[challenge.difficulty]}</Text>
        </View>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>{challenge.durationDays} days</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>GOAL</Text>
        <Text style={styles.goalText}>{goalText}</Text>
        <Text style={styles.body}>{challenge.description}</Text>
        {challenge.autoSource && (
          <View style={styles.autoRow}>
            <Ionicons name="watch-outline" size={16} color={colors.green} />
            <Text style={styles.autoText}>
              {challenge.autoSource === 'steps' ? 'Steps' : 'Sleep'} are counted automatically from your watch. You can also add
              them by hand.
            </Text>
          </View>
        )}
      </View>
      <View style={[styles.card, styles.tipCard]}>
        <Ionicons name="bulb-outline" size={18} color={colors.badge.orangeIcon} />
        <Text style={[styles.body, styles.flex]}>{challenge.tip}</Text>
      </View>
    </>
  );

  if (!run || run.status === 'left') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.heroIcon}>
          <Ionicons name={challenge.icon} size={40} color={colors.green} />
        </View>
        <Text style={[typography.heading, styles.center]}>{challenge.title}</Text>
        {overview}
        <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]} onPress={join} disabled={isBusy}>
          {isBusy ? <ActivityIndicator color="#FFFFFF" /> : (
            <>
              <Text style={typography.button}>Join challenge</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
        <Text style={styles.footnote}>Starts today and ends {formatCalendarDate(fromDayKey(dayKey(new Date(Date.now() + (challenge.durationDays - 1) * 86_400_000))))}.</Text>
      </ScrollView>
    );
  }

  const p = runProgress(run, challenge, today);
  const isActive = run.status === 'active';
  const ringCenter =
    challenge.mode === 'total'
      ? `${Math.round(p.totalValue * 10) / 10}`
      : `${p.daysMet}/${challenge.durationDays}`;
  const ringCaption = challenge.mode === 'total' ? `of ${formatAmount(challenge.target, challenge.unit)}` : 'days done';
  const entries = [...run.entries].sort((a, b) => b.at.localeCompare(a.at) || b.date.localeCompare(a.date));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {run.status === 'completed' && (
          <View style={styles.celebrate}>
            <Text style={styles.medal}>🏅</Text>
            <Text style={styles.celebrateTitle}>Challenge completed!</Text>
            <Text style={styles.body}>
              Finished {formatCalendarDate(new Date(run.finishedAt ?? run.joinedAt))}. Great work.
            </Text>
          </View>
        )}
        {run.status === 'ended' && (
          <View style={[styles.card, styles.endedCard]}>
            <Text style={styles.endedTitle}>Challenge ended · {p.percent}%</Text>
            <Text style={styles.body}>It ended on {formatCalendarDate(fromDayKey(run.endDate))}. Ready for another go?</Text>
          </View>
        )}

        <View style={styles.hero}>
          <ProgressRing size={168} stroke={14} percent={p.percent}>
            <Text style={styles.ringValue}>{ringCenter}</Text>
            <Text style={styles.ringCaption}>{ringCaption}</Text>
          </ProgressRing>
          <Text style={styles.heroMeta}>
            {isActive ? `Day ${p.dayNumber} of ${challenge.durationDays} · ends ${formatCalendarDate(fromDayKey(run.endDate))}` : `${p.percent}% complete`}
          </Text>
        </View>

        {isActive && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>TODAY</Text>
            {challenge.mode === 'check' ? (
              p.todayValue > 0 ? (
                <View style={styles.checkRow}>
                  <Ionicons name="checkmark-circle" size={28} color={colors.green} />
                  <Text style={[styles.goalText, styles.flex]}>Done for today</Text>
                  <Pressable
                    onPress={() => {
                      const todays = run.entries.filter((e) => e.date === today && e.source === 'manual');
                      if (todays.length) undo(todays[todays.length - 1].id);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.link}>Undo</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={({ pressed }) => [styles.cta, styles.ctaInline, pressed && styles.pressed]} onPress={() => add(1)} disabled={isBusy}>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  <Text style={typography.button}>Mark today done</Text>
                </Pressable>
              )
            ) : (
              <>
                <Text style={styles.todayValue}>
                  {formatAmount(p.todayValue, challenge.unit)}
                  {challenge.mode === 'daily' && (
                    <Text style={styles.todayTarget}> / {formatAmount(challenge.target, challenge.unit)}</Text>
                  )}
                </Text>
                {challenge.mode === 'daily' && (
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.min(100, (p.todayValue / challenge.target) * 100)}%` }]} />
                  </View>
                )}
                <View style={styles.quickRow}>
                  {challenge.quickAdd.map((q) => (
                    <Pressable key={q} style={({ pressed }) => [styles.quick, pressed && styles.pressed]} onPress={() => add(q)} disabled={isBusy}>
                      <Text style={styles.quickText}>+{formatAmount(q, challenge.unit)}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.customRow}>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder={`Other amount (${challenge.unit})`}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={addCustom}
                  />
                  <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.pressed]} onPress={addCustom} disabled={isBusy}>
                    {isBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.addButtonText}>Add</Text>}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}

        {challenge.mode !== 'total' && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>DAYS</Text>
            <View style={styles.daysGrid}>
              {p.days.map((d) => {
                const date = fromDayKey(d.date);
                const missed = d.state === 'past' && !d.met;
                return (
                  <View key={d.date} style={styles.dayCell}>
                    <Text style={styles.dayLetter}>{WEEKDAY_LETTER[date.getDay()]}</Text>
                    <View
                      style={[
                        styles.dayCircle,
                        d.met && styles.dayMet,
                        missed && styles.dayMissed,
                        d.state === 'today' && !d.met && styles.dayToday,
                      ]}
                    >
                      {d.met ? (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      ) : missed ? (
                        <Ionicons name="close" size={16} color={colors.danger} />
                      ) : (
                        <Text style={[styles.dayNum, d.state === 'future' && styles.dayNumFuture]}>{date.getDate()}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>🔥 {p.streak}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{formatAmount(p.bestDay, challenge.unit)}</Text>
            <Text style={styles.statLabel}>Best day</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{formatAmount(p.totalValue, challenge.unit)}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {isActive && (
          <View style={[styles.card, styles.tipCard]}>
            <Ionicons name="bulb-outline" size={18} color={colors.badge.orangeIcon} />
            <Text style={[styles.body, styles.flex]}>{challenge.tip}</Text>
          </View>
        )}

        {isActive && (
          <Pressable style={({ pressed }) => [styles.remind, pressed && styles.pressed]} onPress={remindMe}>
            <Ionicons name="alarm-outline" size={18} color={colors.green} />
            <Text style={styles.remindText}>Remind me daily</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.green} />
          </Pressable>
        )}

        {entries.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>HISTORY</Text>
            <View style={styles.historyCard}>
              {entries.slice(0, 30).map((e, i) => (
                <View key={e.id} style={[styles.historyRow, i > 0 && styles.historyDivider]}>
                  <Ionicons
                    name={e.source === 'watch' ? 'watch-outline' : 'create-outline'}
                    size={16}
                    color={e.source === 'watch' ? colors.green : colors.textSecondary}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.historyValue}>
                      {challenge.mode === 'check' ? 'Checked in' : `+${formatAmount(e.value, challenge.unit)}`}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {formatCalendarDate(fromDayKey(e.date))} · {e.source === 'watch' ? 'from watch' : 'added by you'}
                    </Text>
                  </View>
                  {isActive && e.source === 'manual' && (
                    <Pressable onPress={() => undo(e.id)} hitSlop={8} accessibilityLabel="Remove entry">
                      <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {isActive ? (
          <Pressable style={styles.leave} onPress={confirmLeave} hitSlop={8}>
            <Text style={styles.leaveText}>Leave challenge</Text>
          </Pressable>
        ) : (
          <Pressable style={({ pressed }) => [styles.cta, pressed && styles.pressed]} onPress={join} disabled={isBusy}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={typography.button}>{run.status === 'completed' ? 'Do it again' : 'Try again'}</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.75 },
  muted: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  link: { fontSize: 13, fontWeight: '700', color: colors.green },
  body: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  heroIcon: {
    alignSelf: 'center', width: 84, height: 84, borderRadius: 42, backgroundColor: colors.blobLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  infoPill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  infoPillText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  card: {
    marginTop: spacing.md, padding: spacing.md, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  cardLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.6, marginBottom: spacing.sm },
  goalText: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  autoRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'flex-start' },
  autoText: { flex: 1, fontSize: 12, color: colors.green, lineHeight: 17 },
  tipCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.badge.orangeBg, borderColor: colors.badge.orangeBg },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 16, borderRadius: 30, marginTop: spacing.xl, minHeight: 56,
  },
  ctaInline: { marginTop: 0 },
  footnote: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },

  celebrate: {
    alignItems: 'center', padding: spacing.lg, borderRadius: 20, backgroundColor: colors.blobLight, marginBottom: spacing.sm,
  },
  medal: { fontSize: 48 },
  celebrateTitle: { fontSize: 20, fontWeight: '800', color: colors.green, marginVertical: 4 },
  endedCard: { marginTop: 0, borderColor: colors.badge.orangeBg },
  endedTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },

  hero: { alignItems: 'center', marginTop: spacing.md },
  ringValue: { fontSize: 34, fontWeight: '800', color: colors.textPrimary },
  ringCaption: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  heroMeta: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md },

  todayValue: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  todayTarget: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.background, marginTop: spacing.sm, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.green },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  quick: {
    paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: 999,
    backgroundColor: colors.blobLight, borderWidth: 1, borderColor: colors.green,
  },
  quickText: { fontSize: 14, fontWeight: '800', color: colors.green },
  customRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.md,
    paddingVertical: 10, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.background,
  },
  addButton: { minWidth: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.green },
  addButtonText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm },
  dayCell: { width: '14.28%', alignItems: 'center' },
  dayLetter: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  dayCircle: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  dayMet: { backgroundColor: colors.green, borderColor: colors.green },
  dayMissed: { backgroundColor: '#FCE1E1', borderColor: '#F3C6C6' },
  dayToday: { borderColor: colors.green, borderWidth: 2 },
  dayNum: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  dayNumFuture: { color: colors.textSecondary },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stat: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: 4, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginTop: 2 },

  remind: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md,
    paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.green,
  },
  remindText: { fontSize: 14, fontWeight: '800', color: colors.green },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: spacing.sm },
  historyCard: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  historyDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  historyValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  historyMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  leave: { alignItems: 'center', marginTop: spacing.xl, paddingVertical: spacing.sm },
  leaveText: { fontSize: 13, fontWeight: '700', color: colors.danger },
});
