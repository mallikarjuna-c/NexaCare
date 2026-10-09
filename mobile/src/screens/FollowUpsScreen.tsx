import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useFamily } from '../context/FamilyContext';
import ProfileBanner from '../components/ProfileBanner';
import { possessive } from '../types/family';
import FollowUpCard from '../components/FollowUpCard';
import { getActiveReminderIds, getFollowUps, setFollowUpStatus } from '../services/followUpService';
import { isOverdue, type FollowUp } from '../types/followUps';
import { colors, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'FollowUps'>;
type Tab = 'upcoming' | 'history';

const DANGER_TINT = '#FCE1E1';

export default function FollowUpsScreen({ navigation }: Props) {
  const { activeProfile } = useFamily();
  const profileId = activeProfile?.id;
  const canEdit = activeProfile?.canEdit ?? true;
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activeReminders, setActiveReminders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoadError(false);
    try {
      const [list, reminders] = await Promise.all([getFollowUps(profileId), getActiveReminderIds(profileId)]);
      setFollowUps(list);
      setActiveReminders(reminders);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleComplete = async (followUp: FollowUp) => {
    if (!profileId || busyId) return;
    setBusyId(followUp.id);
    try {
      await setFollowUpStatus(profileId, followUp.id, 'completed');
      await load();
    } catch {
      Alert.alert('Something went wrong', "We couldn't update this follow-up. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = (followUp: FollowUp) => navigation.navigate('FollowUpDetail', { followUpId: followUp.id });

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
        <View style={[styles.stateIcon, { backgroundColor: DANGER_TINT }]}>
          <Ionicons name="cloud-offline-outline" size={26} color={colors.danger} />
        </View>
        <Text style={styles.stateTitle}>Couldn't load follow-ups</Text>
        <Text style={styles.stateBody}>Please try again.</Text>
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

  const now = Date.now();
  const overdue = followUps.filter((f) => isOverdue(f, now));
  const upcoming = followUps.filter((f) => f.status === 'scheduled' && !isOverdue(f, now));
  const history = followUps
    .filter((f) => f.status !== 'scheduled')
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const completedCount = followUps.filter((f) => f.status === 'completed').length;

  const renderCard = (f: FollowUp) => (
    <FollowUpCard
      key={f.id}
      followUp={f}
      overdue={isOverdue(f, now)}
      hasReminder={activeReminders.has(f.id)}
      isBusy={busyId === f.id}
      onPress={() => openDetail(f)}
      onComplete={canEdit && f.status === 'scheduled' ? () => handleComplete(f) : undefined}
    />
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ProfileBanner what="follow-ups" style={styles.banner} />
      <View style={styles.headerRow}>
        <View style={styles.flexText}>
          <Text style={styles.headerTitle}>{activeProfile ? possessive(activeProfile) : 'Your'} follow-ups</Text>
          <Text style={styles.headerSubtitle}>Appointments, tests & medication reviews</Text>
        </View>
        {canEdit && (
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate('AddFollowUp')}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{upcoming.length}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </View>
        <View style={[styles.statTile, overdue.length > 0 && styles.statTileDanger]}>
          <Text style={[styles.statValue, overdue.length > 0 && styles.statValueDanger]}>{overdue.length}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      <View style={styles.segment}>
        {(['upcoming', 'history'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.segmentItem, tab === t && styles.segmentItemActive]} onPress={() => setTab(t)}>
            <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
              {t === 'upcoming' ? 'Upcoming' : 'History'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'upcoming' ? (
        overdue.length === 0 && upcoming.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={[styles.stateIcon, { backgroundColor: colors.badge.blueBg }]}>
              <Ionicons name="calendar-outline" size={26} color={colors.badge.blueIcon} />
            </View>
            <Text style={styles.stateTitle}>No upcoming follow-ups</Text>
            <Text style={styles.stateBody}>
              Add doctor appointments, prescribed tests or medication reviews and we'll remind you before they're due.
            </Text>
            {canEdit && (
              <Pressable
                style={({ pressed }) => [styles.pillButton, styles.retryButton, pressed && styles.pressed]}
                onPress={() => navigation.navigate('AddFollowUp')}
              >
                <Text style={styles.pillButtonText}>Add follow-up</Text>
                <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {overdue.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, styles.sectionDanger]}>Needs attention</Text>
                <View style={styles.list}>{overdue.map(renderCard)}</View>
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, overdue.length > 0 && styles.sectionSpacing]}>Scheduled</Text>
                <View style={styles.list}>{upcoming.map(renderCard)}</View>
              </>
            )}
          </>
        )
      ) : history.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={[styles.stateIcon, { backgroundColor: colors.badge.greenBg }]}>
            <Ionicons name="checkmark-done-outline" size={26} color={colors.badge.greenIcon} />
          </View>
          <Text style={styles.stateTitle}>No history yet</Text>
          <Text style={styles.stateBody}>Completed and cancelled follow-ups will appear here.</Text>
        </View>
      ) : (
        <View style={styles.list}>{history.map(renderCard)}</View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  banner: { marginBottom: spacing.md },
  flexText: { flex: 1 },
  pressed: { opacity: 0.7 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  headerSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 20,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statTile: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  statTileDanger: { borderColor: '#F3C6C6', backgroundColor: DANGER_TINT },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  statValueDanger: { color: colors.danger },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  segment: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, padding: 4, marginBottom: spacing.lg,
  },
  segmentItem: { flex: 1, paddingVertical: spacing.sm, borderRadius: 999, alignItems: 'center' },
  segmentItemActive: { backgroundColor: colors.green },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  segmentTextActive: { color: '#FFFFFF' },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  sectionDanger: { color: colors.danger },
  sectionSpacing: { marginTop: spacing.lg },
  list: { gap: spacing.sm },

  emptyCard: {
    alignItems: 'center', padding: spacing.xl, backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  stateIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  stateTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  stateBody: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, lineHeight: 18 },

  pillButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999,
  },
  pillButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  retryButton: { marginTop: spacing.lg },
});
