import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../navigation/HomeStack';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import ProfileBanner from '../components/ProfileBanner';
import { getReminders, setReminderActive } from '../services/reminderService';
import { rescheduleReminders } from '../services/reminderScheduler';
import { KIND_INFO, formatTimeLabel, reminderDetail, repeatSummary, type Reminder } from '../types/reminders';
import { colors, typography, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'ManageReminders'>;

export default function ManageRemindersScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { activeProfile } = useFamily();
  const profileId = activeProfile?.id;
  const canEdit = activeProfile?.canEdit ?? true;
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoadError(false);
    try {
      setReminders(await getReminders(profileId));
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (reminder: Reminder, active: boolean) => {
    if (!profileId || !user) return;
    setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, active } : r)));
    try {
      await setReminderActive(profileId, reminder.id, active);
      rescheduleReminders(user.id).catch(() => {});
    } catch {
      Alert.alert('Something went wrong', 'Please try again.');
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
        <Text style={styles.muted}>Couldn’t load reminders.</Text>
        <Pressable onPress={() => { setIsLoading(true); load(); }} hitSlop={8}>
          <Text style={styles.link}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const activeList = reminders.filter((r) => r.active);
  const paused = reminders.filter((r) => !r.active);

  const renderCard = (r: Reminder) => {
    const detail = reminderDetail(r);
    return (
      <Pressable
        key={r.id}
        style={({ pressed }) => [styles.card, !r.active && styles.cardPaused, pressed && canEdit && styles.pressed]}
        onPress={canEdit ? () => navigation.navigate('AddReminder', { reminderId: r.id }) : undefined}
        disabled={!canEdit}
      >
        <View style={styles.icon}>
          <Ionicons name={KIND_INFO[r.kind].icon} size={20} color={colors.green} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title} numberOfLines={1}>{r.title}</Text>
          {!!detail && <Text style={styles.detail} numberOfLines={1}>{detail}</Text>}
          <Text style={styles.schedule} numberOfLines={2}>
            {r.times.map(formatTimeLabel).join(' · ')} — {repeatSummary(r)}
          </Text>
        </View>
        {canEdit && (
          <Switch
            value={r.active}
            onValueChange={(v) => toggle(r, v)}
            trackColor={{ true: colors.green, false: colors.border }}
            thumbColor="#FFFFFF"
            accessibilityLabel={`${r.title} ${r.active ? 'on' : 'paused'}`}
          />
        )}
      </Pressable>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ProfileBanner what="reminders" style={styles.banner} />
      {reminders.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="alarm-outline" size={30} color={colors.green} />
          <Text style={styles.emptyTitle}>No reminders yet</Text>
          <Text style={styles.muted}>Add a medicine, a check-up or a healthy habit to get reminded.</Text>
        </View>
      ) : (
        <>
          {activeList.length > 0 && (
            <>
              <Text style={styles.section}>ACTIVE · {activeList.length}</Text>
              <View style={styles.list}>{activeList.map(renderCard)}</View>
            </>
          )}
          {paused.length > 0 && (
            <>
              <Text style={[styles.section, styles.sectionSpacing]}>PAUSED · {paused.length}</Text>
              <View style={styles.list}>{paused.map(renderCard)}</View>
            </>
          )}
        </>
      )}

      {canEdit && (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          onPress={() => navigation.navigate('AddReminder')}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={typography.button}>Add reminder</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  banner: { marginBottom: spacing.md },
  muted: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  link: { fontSize: 13, fontWeight: '700', color: colors.green },

  section: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.6, marginBottom: spacing.sm },
  sectionSpacing: { marginTop: spacing.lg },
  list: { gap: spacing.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  cardPaused: { opacity: 0.6 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blobLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  detail: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  schedule: { fontSize: 12, fontWeight: '600', color: colors.green, marginTop: 4 },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.green, paddingVertical: 15, borderRadius: 30, marginTop: spacing.xl,
  },
});
