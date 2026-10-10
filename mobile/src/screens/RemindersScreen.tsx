import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import ProfileBanner from '../components/ProfileBanner';
import { getDoseLogs, getReminders, logDose, subscribeToReminders, undoDose } from '../services/reminderService';
import { rescheduleReminders } from '../services/reminderScheduler';
import { getFollowUps } from '../services/followUpService';
import { getPermissionState, requestNotificationPermission } from '../services/notificationService';
import {
  KIND_INFO,
  TEMPLATES,
  WEEKDAY_SHORT,
  adherenceBetween,
  dayPart,
  formatClock,
  occurrencesForDay,
  reminderDetail,
  toDayKey,
  type DoseLog,
  type Occurrence,
  type Reminder,
} from '../types/reminders';
import type { FollowUp } from '../types/followUps';
import type { NotificationPermissionState } from '../types/notifications';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Reminders'>;

const DANGER_TINT = '#FCE1E1';
const KIND_TINT: Record<Reminder['kind'], { bg: string; fg: string }> = {
  medicine: { bg: colors.badge.purpleBg, fg: colors.badge.purpleIcon },
  measurement: { bg: colors.badge.blueBg, fg: colors.badge.blueIcon },
  activity: { bg: colors.badge.greenBg, fg: colors.badge.greenIcon },
  custom: { bg: colors.badge.orangeBg, fg: colors.badge.orangeIcon },
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayTitle(day: Date, today: Date) {
  const diff = Math.round((startOfDay(day).getTime() - startOfDay(today).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return `${WEEKDAY_SHORT[day.getDay()]}, ${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

export default function RemindersScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { activeProfile } = useFamily();
  const profileId = activeProfile?.id;
  const canEdit = activeProfile?.canEdit ?? true;

  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [appointments, setAppointments] = useState<FollowUp[]>([]);
  const [permission, setPermission] = useState<NotificationPermissionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('ManageReminders')} hitSlop={10} accessibilityRole="button">
          <Text style={styles.headerLink}>Manage</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoadError(false);
    try {
      const [list, doseLogs, followUps, perm] = await Promise.all([
        getReminders(profileId),
        getDoseLogs(profileId),
        getFollowUps(profileId).catch(() => [] as FollowUp[]),
        getPermissionState(),
      ]);
      setReminders(list);
      setLogs(doseLogs);
      setAppointments(followUps.filter((f) => f.status === 'scheduled'));
      setPermission(perm);
      setNow(new Date());
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useFocusEffect(
    useCallback(() => {
      load();
      const unsubscribe = subscribeToReminders(() => {
        load();
      });
      const timer = setInterval(() => setNow(new Date()), 60_000);
      return () => {
        unsubscribe();
        clearInterval(timer);
      };
    }, [load])
  );

  useEffect(() => {
    setSelected(startOfDay(new Date()));
  }, [profileId]);

  const today = startOfDay(now);
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3 + i)),
    [today.getTime()]
  );
  const occurrences = useMemo(() => occurrencesForDay(reminders, logs, selected, now), [reminders, logs, selected, now]);
  const dayAppointments = appointments
    .filter((f) => toDayKey(new Date(f.scheduledAt)) === toDayKey(selected))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  const adherence = adherenceBetween(reminders, logs, weekStart, now);
  const groups = (['Morning', 'Afternoon', 'Evening', 'Night'] as const)
    .map((part) => ({ part, items: occurrences.filter((o) => dayPart(o.at) === part) }))
    .filter((g) => g.items.length);
  const isPastOrToday = selected <= today;

  const record = async (occurrence: Occurrence, status: 'taken' | 'skipped') => {
    if (!profileId || !user) return;
    setBusyKey(occurrence.key);
    try {
      await logDose(profileId, occurrence.reminder.id, occurrence.at, status);
      rescheduleReminders(user.id).catch(() => {});
      if (status === 'taken' && occurrence.reminder.kind === 'measurement' && occurrence.reminder.measurementType) {
        navigation.navigate('AddRecord', { initialType: occurrence.reminder.measurementType });
      }
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setBusyKey(null);
    }
  };

  const undo = (occurrence: Occurrence) =>
    Alert.alert('Undo?', `Mark “${occurrence.reminder.title}” at ${formatClock(occurrence.at)} as not done?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Undo',
        onPress: async () => {
          if (!profileId || !user) return;
          await undoDose(profileId, occurrence.reminder.id, occurrence.at).catch(() => {});
          rescheduleReminders(user.id).catch(() => {});
        },
      },
    ]);

  const fixPermission = async () => {
    if (permission === 'denied') Linking.openSettings();
    else setPermission(await requestNotificationPermission().catch(() => permission));
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
        <Text style={styles.muted}>Couldn’t load reminders.</Text>
        <Pressable onPress={() => { setIsLoading(true); load(); }} hitSlop={8}>
          <Text style={styles.link}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const renderOccurrence = (o: Occurrence) => {
    const info = KIND_INFO[o.reminder.kind];
    const tint = KIND_TINT[o.reminder.kind];
    const detail = reminderDetail(o.reminder);
    const actionable = canEdit && (o.state === 'due' || o.state === 'missed');
    const primary = o.reminder.kind === 'medicine' ? 'Take' : o.reminder.kind === 'measurement' ? 'Measure' : 'Done';
    return (
      <View key={o.key} style={[styles.item, o.state === 'due' && styles.itemDue]}>
        <View style={styles.itemTop}>
          <Text style={[styles.time, (o.state === 'taken' || o.state === 'skipped') && styles.timeMuted]}>
            {formatClock(o.at)}
          </Text>
          <View style={[styles.kindIcon, { backgroundColor: tint.bg }]}>
            <Ionicons name={info.icon} size={18} color={tint.fg} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.itemTitle, o.state === 'skipped' && styles.strike]} numberOfLines={1}>
              {o.reminder.title}
            </Text>
            {!!detail && (
              <Text style={styles.itemDetail} numberOfLines={1}>
                {detail}
              </Text>
            )}
          </View>
          {o.state === 'taken' && (
            <Pressable style={[styles.chip, styles.chipTaken]} onPress={canEdit ? () => undo(o) : undefined} disabled={!canEdit}>
              <Ionicons name="checkmark" size={13} color={colors.green} />
              <Text style={[styles.chipText, { color: colors.green }]}>Done</Text>
            </Pressable>
          )}
          {o.state === 'skipped' && (
            <Pressable style={[styles.chip, styles.chipSkipped]} onPress={canEdit ? () => undo(o) : undefined} disabled={!canEdit}>
              <Text style={[styles.chipText, { color: colors.textSecondary }]}>Skipped</Text>
            </Pressable>
          )}
          {o.state === 'missed' && (
            <View style={[styles.chip, styles.chipMissed]}>
              <Text style={[styles.chipText, { color: colors.danger }]}>Missed</Text>
            </View>
          )}
          {o.state === 'due' && (
            <View style={[styles.chip, styles.chipDue]}>
              <Text style={[styles.chipText, { color: colors.badge.orangeIcon }]}>Due now</Text>
            </View>
          )}
        </View>
        {actionable && (
          <View style={styles.actions}>
            {busyKey === o.key ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Pressable style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]} onPress={() => record(o, 'taken')}>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  <Text style={styles.actionPrimaryText}>{primary}</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.actionGhost, pressed && styles.pressed]} onPress={() => record(o, 'skipped')}>
                  <Text style={styles.actionGhostText}>Skip</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileBanner what="reminders" style={styles.banner} />

        {permission && permission !== 'granted' && permission !== 'unsupported' && (
          <Pressable style={({ pressed }) => [styles.warning, pressed && styles.pressed]} onPress={fixPermission}>
            <Ionicons name="notifications-off-outline" size={18} color={colors.danger} />
            <Text style={styles.warningText}>
              {permission === 'denied'
                ? 'Notifications are blocked, so reminders can’t ring. Tap to allow them in Settings.'
                : 'Allow notifications so your reminders can ring.'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.danger} />
          </Pressable>
        )}

        <View style={styles.weekRow}>
          {week.map((day) => {
            const active = toDayKey(day) === toDayKey(selected);
            const isToday = toDayKey(day) === toDayKey(today);
            return (
              <Pressable
                key={toDayKey(day)}
                style={[styles.dayChip, active && styles.dayChipActive]}
                onPress={() => setSelected(day)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.dayName, active && styles.dayTextActive]}>{WEEKDAY_SHORT[day.getDay()]}</Text>
                <Text style={[styles.dayNumber, active && styles.dayTextActive]}>{day.getDate()}</Text>
                <View style={[styles.todayDot, isToday && (active ? styles.todayDotActive : styles.todayDotOn)]} />
              </Pressable>
            );
          })}
        </View>

        {reminders.length > 0 && adherence.percent !== null && (
          <View style={styles.adherence}>
            <View style={styles.adherenceTop}>
              <View style={styles.flex}>
                <Text style={styles.adherenceLabel}>LAST 7 DAYS</Text>
                <Text style={styles.adherenceValue}>
                  {adherence.taken} of {adherence.total} done
                </Text>
              </View>
              <Text style={[styles.adherencePercent, adherence.percent < 70 && { color: colors.danger }]}>
                {adherence.percent}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${adherence.percent}%` },
                  adherence.percent < 70 && { backgroundColor: colors.danger },
                ]}
              />
            </View>
          </View>
        )}

        <Text style={styles.dayHeading}>{dayTitle(selected, today)}</Text>

        {reminders.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="alarm-outline" size={30} color={colors.green} />
            </View>
            <Text style={styles.emptyTitle}>No reminders yet</Text>
            <Text style={styles.muted}>Set reminders for medicines, check-ups and healthy habits.</Text>
            {canEdit && (
              <View style={styles.templates}>
                {TEMPLATES.map((t, index) => (
                  <Pressable
                    key={t.title}
                    style={({ pressed }) => [styles.template, pressed && styles.pressed]}
                    onPress={() => navigation.navigate('AddReminder', { templateIndex: index })}
                  >
                    <Ionicons name={KIND_INFO[t.kind].icon} size={15} color={colors.green} />
                    <Text style={styles.templateText}>{t.title}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.dayEmpty}>
            <Ionicons name="checkmark-done-outline" size={22} color={colors.textSecondary} />
            <Text style={styles.muted}>Nothing scheduled for this day.</Text>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.part} style={styles.group}>
              <Text style={styles.groupLabel}>{g.part.toUpperCase()}</Text>
              <View style={styles.list}>{g.items.map(renderOccurrence)}</View>
            </View>
          ))
        )}

        {dayAppointments.length > 0 && (
          <View style={styles.group}>
            <Text style={styles.groupLabel}>APPOINTMENTS</Text>
            <View style={styles.list}>
              {dayAppointments.map((f) => (
                <Pressable
                  key={f.id}
                  style={({ pressed }) => [styles.item, pressed && styles.pressed]}
                  onPress={() => navigation.navigate('FollowUpDetail', { followUpId: f.id })}
                >
                  <View style={styles.itemTop}>
                    <Text style={styles.time}>{formatClock(new Date(f.scheduledAt))}</Text>
                    <View style={[styles.kindIcon, { backgroundColor: colors.badge.purpleBg }]}>
                      <Ionicons name="calendar-outline" size={18} color={colors.badge.purpleIcon} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{f.title}</Text>
                      {!!f.providerName && <Text style={styles.itemDetail} numberOfLines={1}>{f.providerName}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {!isPastOrToday && occurrences.length > 0 && (
          <Text style={styles.footnote}>You can mark these as done when they’re due.</Text>
        )}
      </ScrollView>

      {canEdit && (
        <View style={styles.ctaWrap}>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            onPress={() => navigation.navigate('AddReminder')}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
            <Text style={typography.button}>Add reminder</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: 110 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  muted: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  link: { fontSize: 13, fontWeight: '700', color: colors.green },
  headerLink: { fontSize: 15, fontWeight: '700', color: colors.green },
  banner: { marginBottom: spacing.md },

  warning: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md,
    padding: spacing.md, borderRadius: 14, backgroundColor: DANGER_TINT,
  },
  warningText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.danger, lineHeight: 18 },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  dayChip: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  dayChipActive: { backgroundColor: colors.green, borderColor: colors.green },
  dayName: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  dayNumber: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  dayTextActive: { color: '#FFFFFF' },
  todayDot: { width: 5, height: 5, borderRadius: 3, marginTop: 4, backgroundColor: 'transparent' },
  todayDotOn: { backgroundColor: colors.green },
  todayDotActive: { backgroundColor: '#FFFFFF' },

  adherence: {
    marginTop: spacing.md, padding: spacing.md, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  adherenceTop: { flexDirection: 'row', alignItems: 'center' },
  adherenceLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5 },
  adherenceValue: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  adherencePercent: { fontSize: 24, fontWeight: '800', color: colors.green },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.background, marginTop: spacing.sm, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.green },

  dayHeading: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.lg },
  group: { marginTop: spacing.md },
  groupLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.6, marginBottom: spacing.sm },
  list: { gap: spacing.sm },

  item: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  itemDue: { borderColor: colors.badge.orangeIcon, borderWidth: 1.5 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  time: { width: 66, fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  timeMuted: { color: colors.textSecondary },
  kindIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  itemDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  strike: { textDecorationLine: 'line-through', color: colors.textSecondary },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '800' },
  chipTaken: { backgroundColor: colors.badge.greenBg },
  chipSkipped: { backgroundColor: colors.background },
  chipMissed: { backgroundColor: DANGER_TINT },
  chipDue: { backgroundColor: colors.badge.orangeBg },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginLeft: 66 + spacing.sm },
  actionPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: 999, backgroundColor: colors.green,
  },
  actionPrimaryText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  actionGhost: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  actionGhostText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },

  empty: { alignItems: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.md },
  emptyIcon: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: colors.blobLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  templates: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg },
  template: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: colors.green, backgroundColor: colors.surface,
  },
  templateText: { fontSize: 13, fontWeight: '700', color: colors.green },
  dayEmpty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, justifyContent: 'center' },
  footnote: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },

  ctaWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 15, borderRadius: 30,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
});
